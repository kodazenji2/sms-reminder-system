import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendSMS, buildReminderMessage } from "@/lib/termii";

/**
 * GET /api/cron/send-reminders
 *
 * Called every 5 minutes by Vercel Cron (see vercel.json).
 * Finds any classes starting within the next 30 minutes (±2 min window)
 * that have not already received a reminder today, then sends SMS via Termii.
 *
 * Security: Vercel Cron passes the CRON_SECRET in the Authorization header
 * automatically. Any other caller without the secret is rejected.
 *
 * Timezone: All comparisons use WAT (UTC+1, Nigeria standard time).
 */
export async function GET(request: Request) {

  // ── Auth ─────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  // ── Time calculation (WAT = UTC+1) ────────────────────────────────────────
  // This endpoint is intended to be called hourly by an external scheduler
  // (e.g. cron-job.org). We compute a ±window around now in WAT and send any
  // reminder whose scheduled send time falls inside that window.
  const WINDOW_MINUTES = 30; // ±30 minutes to allow hourly triggers

  const nowUTC = new Date();
  const watOffset = 60 * 60 * 1000; // UTC+1
  const watNow = new Date(nowUTC.getTime() + watOffset);

  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const todayDay = DAYS[watNow.getUTCDay()];
  const tomorrow = new Date(watNow.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowDay = DAYS[tomorrow.getUTCDay()];

  const windowStart = new Date(watNow.getTime() - WINDOW_MINUTES * 60 * 1000);
  const windowEnd = new Date(watNow.getTime() + WINDOW_MINUTES * 60 * 1000);

  // ── Query classes due for a reminder ─────────────────────────────────────
  const supabase = createAdminClient();

  // Query timetable entries for today and tomorrow - we decide class date per-entry
  const { data: entries, error: fetchError } = await supabase
    .from("timetable")
    .select(`
      id, course_code, course_name, start_time, venue, day_of_week, active,
      lecturer:profiles!lecturer_id (id, full_name, phone, reminder_preferences)
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

  // ── Send reminders ────────────────────────────────────────────────────────
  const results: { course: string; lecturer: string; phone: string; status: string }[] = [];

  // Helper: parse HH:MM:SS -> { h, m }
  const parseTime = (t: string) => {
    const parts = (t || "00:00:00").split(":");
    return { h: parseInt(parts[0] || "0", 10), m: parseInt(parts[1] || "0", 10) };
  };

  // For each timetable entry decide the class date (today or tomorrow), compute
  // scheduled send times for the lecturer's preferences and send when one falls
  // inside the current window.
  for (const entry of entries) {
    const lecturer = Array.isArray(entry.lecturer) ? entry.lecturer[0] : entry.lecturer;

    if (!lecturer?.phone) {
      console.warn(`[Cron] Skipping ${entry.course_code}: no phone for lecturer ${lecturer?.full_name}`);
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
        // 21:00 the day before
        const prev = new Date(classWatMs - 24 * 60 * 60 * 1000);
        const prevYear = prev.getUTCFullYear();
        const prevMonth = prev.getUTCMonth();
        const prevDate = prev.getUTCDate();
        const ms = Date.UTC(prevYear, prevMonth, prevDate, 21, 0, 0) + watOffset;
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

    // See if any scheduled time falls inside window
    let toSendType: string | null = null;
    for (const s of scheduled) {
      if (s.ms >= windowStart.getTime() && s.ms <= windowEnd.getTime()) {
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

    const message = buildReminderMessage({
      courseCode: entry.course_code,
      courseName: entry.course_name,
      startTime: entry.start_time.slice(0, 5),
      venue: entry.venue ?? "TBD",
    });

    const result = await sendSMS(lecturer.phone, message);

    await supabase.from("notifications").insert({
      lecturer_id: lecturer.id,
      timetable_id: entry.id,
      phone: lecturer.phone,
      message,
      status: result.success ? "delivered" : "failed",
      termii_message_id: result.messageId ?? null,
      class_date: classDate,
      reminder_type: toSendType,
    });

    results.push({
      course: `${entry.course_code} – ${entry.course_name}`,
      lecturer: lecturer.full_name,
      phone: lecturer.phone,
      status: result.success ? "delivered" : "failed",
    });

    if (!result.success) {
      console.error(`[Cron] SMS failed for ${lecturer.full_name}: ${result.error}`);
    }
  }

  return NextResponse.json({
    message: `Processed ${results.length} reminder(s).`,
    day: todayDay,
    window: `${wsStr} – ${weStr} WAT`,
    sent: results.length,
    results,
  });
}
