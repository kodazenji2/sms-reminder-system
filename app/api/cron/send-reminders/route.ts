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
  const REMINDER_MINUTES = 30;
  const WINDOW_MINUTES   =  2;    // ±2 min tolerance for cron drift

  const nowUTC    = new Date();
  const watOffset = 60 * 60 * 1000;  // UTC+1
  const watNow    = new Date(nowUTC.getTime() + watOffset);

  const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const todayDay  = DAYS[watNow.getUTCDay()];
  const todayDate = watNow.toISOString().split("T")[0];  // "YYYY-MM-DD"

  // Target time = now + 30 min
  const target    = new Date(watNow.getTime() + REMINDER_MINUTES * 60 * 1000);
  const windowStart = new Date(target.getTime() - WINDOW_MINUTES * 60 * 1000);
  const windowEnd   = new Date(target.getTime() + WINDOW_MINUTES * 60 * 1000);

  const toTimeStr = (d: Date) =>
    `${String(d.getUTCHours()).padStart(2,"0")}:${String(d.getUTCMinutes()).padStart(2,"0")}:00`;

  const wsStr = toTimeStr(windowStart);
  const weStr = toTimeStr(windowEnd);

  // ── Query classes due for a reminder ─────────────────────────────────────
  const supabase = createAdminClient();

  const { data: entries, error: fetchError } = await supabase
    .from("timetable")
    .select(`
      id, course_code, course_name, start_time, venue, day_of_week,
      lecturer:profiles!lecturer_id (id, full_name, phone)
    `)
    .eq("day_of_week", todayDay)
    .eq("active", true)
    .gte("start_time", wsStr)
    .lte("start_time", weStr);

  if (fetchError) {
    console.error("[Cron] Failed to fetch timetable:", fetchError.message);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!entries || entries.length === 0) {
    return NextResponse.json({
      message: "No classes due for a reminder in this window.",
      window: `${wsStr} – ${weStr} WAT`,
      day: todayDay,
      sent: 0,
    });
  }

  // ── Send reminders ────────────────────────────────────────────────────────
  const results: { course: string; lecturer: string; phone: string; status: string }[] = [];

  for (const entry of entries) {
    const lecturer = Array.isArray(entry.lecturer) ? entry.lecturer[0] : entry.lecturer;

    if (!lecturer?.phone) {
      console.warn(`[Cron] Skipping ${entry.course_code}: no phone for lecturer ${lecturer?.full_name}`);
      continue;
    }

    // Check if we already sent a reminder for this class today (avoid duplicates)
    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("timetable_id", entry.id)
      .eq("class_date", todayDate)
      .eq("status", "delivered")
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`[Cron] Skipping ${entry.course_code} — already reminded today.`);
      continue;
    }

    const message = buildReminderMessage({
      courseCode: entry.course_code,
      courseName: entry.course_name,
      startTime:  entry.start_time.slice(0, 5),
      venue:      entry.venue ?? "TBD",
    });

    const result = await sendSMS(lecturer.phone, message);

    // Log every attempt — success or failure
    await supabase.from("notifications").insert({
      lecturer_id:       lecturer.id,
      timetable_id:      entry.id,
      phone:             lecturer.phone,
      message,
      status:            result.success ? "delivered" : "failed",
      termii_message_id: result.messageId ?? null,
      class_date:        todayDate,
    });

    results.push({
      course:   `${entry.course_code} – ${entry.course_name}`,
      lecturer: lecturer.full_name,
      phone:    lecturer.phone,
      status:   result.success ? "delivered" : "failed",
    });

    if (!result.success) {
      console.error(`[Cron] SMS failed for ${lecturer.full_name}: ${result.error}`);
    }
  }

  return NextResponse.json({
    message: `Processed ${results.length} reminder(s).`,
    day:     todayDay,
    window:  `${wsStr} – ${weStr} WAT`,
    sent:    results.length,
    results,
  });
}
