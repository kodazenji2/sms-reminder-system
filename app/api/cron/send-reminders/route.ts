import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendSMS, buildReminderMessage, buildDigestMessage, formatTime12h } from "@/lib/termii";

export async function GET(request: Request) {

  // ── Auth ─────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  // ── Time calculation (WAT = UTC+1) ────────────────────────────────────────
  // This endpoint should be called every 15 minutes by an external scheduler
  // (e.g. cron-job.org). Digest-style reminders (night_before/morning_of)

  const WIDE_WINDOW_MINUTES = 30;
  const TIGHT_WINDOW_MINUTES = 10;
  const TIGHT_TYPES = new Set(["one_hour_before", "thirty_minutes_before"]);

  const nowUTC = new Date();
  const watOffset = 60 * 60 * 1000; // UTC+1
  const watNow = new Date(nowUTC.getTime() + watOffset);

  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const todayDay = DAYS[watNow.getUTCDay()];
  const tomorrow = new Date(watNow.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowDay = DAYS[tomorrow.getUTCDay()];

  // Widest possible window, just for the summary response text below.
  const windowStart = new Date(watNow.getTime() - WIDE_WINDOW_MINUTES * 60 * 1000);
  const windowEnd = new Date(watNow.getTime() + WIDE_WINDOW_MINUTES * 60 * 1000);

  // ── Query classes due for a reminder ─────────────────────────────────────
  const supabase = createAdminClient();

  // Query timetable entries for today and tomorrow - we decide class date per-entry
  const { data: entries, error: fetchError } = await supabase
    .from("timetable")
    .select(`
      id, course_code, course_name, start_time, venue, day_of_week, active,
      lecturer:profiles!lecturer_id (id, full_name, phone, active, reminder_preferences)
    `)
    .in("day_of_week", [todayDay, tomorrowDay])
    .eq("active", true);

  if (fetchError) {
    console.error("[Cron] Failed to fetch timetable:", fetchError.message);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!entries || entries.length === 0) {
    return NextResponse.json({
      message: "No classes found for today/tomorrow.",
      window: `${windowStart.toISOString()} – ${windowEnd.toISOString()} WAT`,
      sent: 0,
    });
  }

  // Helper: parse HH:MM:SS -> { h, m }
  const parseTime = (t: string) => {
    const parts = (t || "00:00:00").split(":");
    return { h: parseInt(parts[0] || "0", 10), m: parseInt(parts[1] || "0", 10) };
  };

  type Eligible = {
    entry: (typeof entries)[number];
    lecturer: { id: string; full_name: string; phone: string; active: boolean };
    toSendType: string;
    classDate: string;
  };

  // ── Phase 1: figure out which entries are due, skipping already-delivered ones ──
  const eligible: Eligible[] = [];

  for (const entry of entries) {
    const lecturer = Array.isArray(entry.lecturer) ? entry.lecturer[0] : entry.lecturer;

    if (!lecturer?.phone) {
      console.warn(`[Cron] Skipping ${entry.course_code}: no phone for lecturer ${lecturer?.full_name}`);
      continue;
    }

    if (!lecturer.active) {
      console.log(`[Cron] Skipping ${entry.course_code}: lecturer ${lecturer.full_name} is inactive.`);
      continue;
    }

    // Determine class date (YYYY-MM-DD) in WAT
    const classDateObj = new Date(watNow);
    if (entry.day_of_week === tomorrowDay) {
      classDateObj.setUTCDate(classDateObj.getUTCDate() + 1);
    }
    const classDate = classDateObj.toISOString().split("T")[0];

    // Parse class start time
    const { h: startH, m: startM } = parseTime(entry.start_time);
    const classWatMs = Date.UTC(
      parseInt(classDate.split("-")[0], 10),
      parseInt(classDate.split("-")[1], 10) - 1,
      parseInt(classDate.split("-")[2], 10),
      startH,
      startM,
      0
    ) + watOffset;

    const prefs: string[] = lecturer.reminder_preferences ?? ["one_hour_before"];

    // Build scheduled send times (WAT ms) per preference
    const scheduled: { type: string; ms: number }[] = [];
    for (const p of prefs) {
      if (p === 'night_before') {
        // 19:00 (7 PM) the day before — kept safely ahead of the NCC's
        // 8:00 PM WAT cutoff for SMS delivery.
        const prev = new Date(classWatMs - 24 * 60 * 60 * 1000);
        const prevYear = prev.getUTCFullYear();
        const prevMonth = prev.getUTCMonth();
        const prevDate = prev.getUTCDate();
        const ms = Date.UTC(prevYear, prevMonth, prevDate, 19, 0, 0) + watOffset;
        scheduled.push({ type: p, ms });
      } else if (p === 'morning_of') {
        // 07:00 on the day of class
        const d = new Date(classWatMs);
        const y = d.getUTCFullYear();
        const mo = d.getUTCMonth();
        const da = d.getUTCDate();
        const ms = Date.UTC(y, mo, da, 7, 0, 0) + watOffset;
        scheduled.push({ type: p, ms });
      } else if (p === 'one_hour_before') {
        scheduled.push({ type: p, ms: classWatMs - 60 * 60 * 1000 });
      } else if (p === 'thirty_minutes_before') {
        scheduled.push({ type: p, ms: classWatMs - 30 * 60 * 1000 });
      }
    }

    // See if any scheduled time falls inside its type's tolerance window
    let toSendType: string | null = null;
    for (const s of scheduled) {
      const tolerance = TIGHT_TYPES.has(s.type) ? TIGHT_WINDOW_MINUTES : WIDE_WINDOW_MINUTES;
      const diffMs = Math.abs(watNow.getTime() - s.ms);
      if (diffMs <= tolerance * 60 * 1000) {
        toSendType = s.type; break;
      }
    }

    if (!toSendType) continue;

    // Avoid duplicate for this timetable_id, class_date and reminder type
    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("timetable_id", entry.id)
      .eq("class_date", classDate)
      .eq("reminder_type", toSendType)
      .eq("status", "delivered")
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`[Cron] Skipping ${entry.course_code} — ${toSendType} already delivered for ${classDate}.`);
      continue;
    }

    eligible.push({ entry, lecturer, toSendType, classDate });
  }

  // ── Phase 2: send. Digest types (night_before/morning_of) get grouped per
  // lecturer into ONE message; immediate types (one_hour_before/
  // thirty_minutes_before) stay as individual per-class messages. ──
  const DIGEST_TYPES = new Set(["night_before", "morning_of"]);

  const digestGroups = new Map<string, Eligible[]>(); // key: lecturerId::toSendType
  const individual: Eligible[] = [];

  for (const item of eligible) {
    if (DIGEST_TYPES.has(item.toSendType)) {
      const key = `${item.lecturer.id}::${item.toSendType}`;
      const group = digestGroups.get(key) ?? [];
      group.push(item);
      digestGroups.set(key, group);
    } else {
      individual.push(item);
    }
  }

  const results: { course: string; lecturer: string; phone: string; status: string }[] = [];

  // Tracks phone numbers already sent to in this run, so we can stagger
  // repeat sends to the same number (avoids carrier flood/anti-spam rejects).
  const sentToPhone = new Set<string>();
  const STAGGER_MS = 4000; // 4s gap between sends to the same number
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const sendAndLog = async (
    phone: string,
    message: string,
    logRows: { lecturer_id: string; timetable_id: string; class_date: string; reminder_type: string }[],
    lecturerName: string,
    courseLabel: string
  ) => {
    if (sentToPhone.has(phone)) {
      console.log(`[Cron] Staggering repeat send to ${phone} by ${STAGGER_MS}ms.`);
      await sleep(STAGGER_MS);
    }
    sentToPhone.add(phone);

    const result = await sendSMS(phone, message);

    // One notification row per timetable entry covered by this message, so
    // per-class dedup still works correctly on future runs — even though
    // only one SMS was actually sent.
    for (const row of logRows) {
      await supabase.from("notifications").insert({
        lecturer_id: row.lecturer_id,
        timetable_id: row.timetable_id,
        phone,
        message,
        status: result.success ? "delivered" : "failed",
        termii_message_id: result.messageId ?? null,
        class_date: row.class_date,
        reminder_type: row.reminder_type,
      });
    }

    results.push({
      course: courseLabel,
      lecturer: lecturerName,
      phone,
      status: result.success ? "delivered" : "failed",
    });

    if (!result.success) {
      console.error(`[Cron] SMS failed for ${lecturerName}: ${result.error}`);
    }
  };

  // Send digests (one message per lecturer per reminder type)
  for (const group of digestGroups.values()) {
    const { lecturer, toSendType } = group[0];
    const message = buildDigestMessage({
      lecturerName: lecturer.full_name,
      reminderType: toSendType as "night_before" | "morning_of",
      classes: group.map((g) => ({
        courseCode: g.entry.course_code,
        startTime: formatTime12h(g.entry.start_time),
        venue: g.entry.venue ?? "TBD",
      })),
    });

    const logRows = group.map((g) => ({
      lecturer_id: lecturer.id,
      timetable_id: g.entry.id,
      class_date: g.classDate,
      reminder_type: g.toSendType,
    }));

    const courseLabel = group.map((g) => g.entry.course_code).join(", ");

    await sendAndLog(lecturer.phone, message, logRows, lecturer.full_name, courseLabel);
  }

  // Send individual reminders (one_hour_before / thirty_minutes_before)
  for (const item of individual) {
    const { entry, lecturer, toSendType, classDate } = item;

    const message = buildReminderMessage({
      courseCode: entry.course_code,
      courseName: entry.course_name,
      startTime: formatTime12h(entry.start_time),
      venue: entry.venue ?? "TBD",
      lecturerName: lecturer.full_name,
    });

    const logRows = [{
      lecturer_id: lecturer.id,
      timetable_id: entry.id,
      class_date: classDate,
      reminder_type: toSendType,
    }];

    await sendAndLog(
      lecturer.phone,
      message,
      logRows,
      lecturer.full_name,
      `${entry.course_code} – ${entry.course_name}`
    );
  }

  return NextResponse.json({
    message: `Processed ${results.length} reminder(s).`,
    day: todayDay,
    window: `${windowStart.toISOString()} – ${windowEnd.toISOString()} WAT`,
    sent: results.length,
    results,
  });
}
