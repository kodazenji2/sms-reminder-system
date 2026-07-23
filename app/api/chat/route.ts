import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nowWAT() {
  const WAT_OFFSET_MS = 60 * 60 * 1000; // UTC+1
  return new Date(Date.now() + WAT_OFFSET_MS);
}

function todayLabel() {
  return DAY_NAMES[nowWAT().getUTCDay()];
}

function yesterdayLabel() {
  return DAY_NAMES[(nowWAT().getUTCDay() + 6) % 7];
}

function tomorrowLabel() {
  return DAY_NAMES[(nowWAT().getUTCDay() + 1) % 7];
}

function match(text: string, pattern: RegExp) {
  return pattern.test(text);
}

function resolveRequestedDay(text: string) {
  if (match(text, /\byesterday\b/)) return yesterdayLabel();
  if (match(text, /\btoday\b/)) return todayLabel();
  if (match(text, /\btomorrow\b|\bnext day\b/)) return tomorrowLabel();

  for (const day of DAY_NAMES) {
    if (match(text, new RegExp(`\\b${day.toLowerCase()}\\b`))) {
      return day;
    }
  }

  return todayLabel();
}

function scopeLabel(text: string) {
  if (match(text, /\bweek\b|\bfull week\b|\bentire week\b/)) return "week";
  return "day";
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const message = body?.message?.toString()?.trim();
  if (!message) {
    return NextResponse.json({ reply: "Please send a message in the request body." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return NextResponse.json({ reply: "Please sign in before using the assistant." }, { status: 401 });
  }

  const userId = userData.user.id;
  const normalized = normalize(message);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  const isAdmin = profile?.role === "admin";
  const requestScope = scopeLabel(normalized);
  const requestedDay = resolveRequestedDay(normalized);

  if (match(normalized, /\b(class(es)?|schedule(s)?|course(s)?|lecture(s)?|lesson(s)?)\b/)) {
    if (requestScope === "week") {
      let weekQuery = supabase
        .from("timetable")
        .select("course_code, course_name, start_time, end_time, venue, day_of_week")
        .eq("active", true)
        .order("day_of_week")
        .order("start_time");

      if (!isAdmin) {
        weekQuery = weekQuery.eq("lecturer_id", userId);
      }

      const { data: classes } = await weekQuery;
      const weeklyEntries = (classes as Array<Record<string, string>> | null) ?? [];

      if (weeklyEntries.length === 0) {
        return NextResponse.json({ reply: "No active classes found for the full week." });
      }

      const grouped = DAY_NAMES.slice(1).map(day => ({
        day,
        entries: weeklyEntries.filter(entry => entry.day_of_week === day),
      }));

      const lines = grouped
        .filter(group => group.entries.length > 0)
        .map(group => {
          const entryLines = group.entries.map(entry =>
            `• ${entry.course_code} ${entry.course_name} at ${entry.start_time.slice(0, 5)}${entry.venue ? `, ${entry.venue}` : ""}`
          );

          return `${group.day}\n${entryLines.join("\n")}`;
        });

      return NextResponse.json({
        reply: `${isAdmin ? "System" : "Your"} full-week schedule:\n${lines.join("\n\n")}`
      });
    }

    let classesQuery = supabase
      .from("timetable")
      .select(isAdmin
        ? "course_code, course_name, start_time, end_time, venue, lecturer:profiles!lecturer_id(full_name)"
        : "course_code, course_name, start_time, end_time, venue")
      .eq("active", true)
      .eq("day_of_week", requestedDay)
      .order("start_time");

    if (!isAdmin) {
      classesQuery = classesQuery.eq("lecturer_id", userId);
    }

    const { data: classes } = await classesQuery;

    if (!classes || classes.length === 0) {
      return NextResponse.json({ reply: `No active classes found for ${requestedDay}.` });
    }

    if (isAdmin) {
      const lines = (classes as unknown as Array<{
        course_code: string; course_name: string; start_time: string;
        venue: string | null; lecturer?: { full_name: string } | { full_name: string }[];
      }>).map(entry => {
        const lecturer = Array.isArray(entry.lecturer) ? entry.lecturer[0] : entry.lecturer;
        return `• ${entry.course_code} ${entry.course_name} at ${entry.start_time.slice(0, 5)}${entry.venue ? `, ${entry.venue}` : ""} — ${lecturer?.full_name ?? "Unassigned"}`;
      });
      return NextResponse.json({
        reply: `There are ${classes.length} class${classes.length === 1 ? "" : "es"} scheduled for ${requestedDay}:\n${lines.join("\n")}`
      });
    }

    const lines = (classes as unknown as Array<Record<string, string>>).map(entry =>
      `• ${entry.course_code} ${entry.course_name} at ${entry.start_time.slice(0, 5)}${entry.venue ? `, ${entry.venue}` : ""}`
    );

    return NextResponse.json({ reply: `Your ${requestedDay} schedule:\n${lines.join("\n")}` });
  }

  if (match(normalized, /\b(change request(s)?|pending request(s)?|request(s)?|request status)\b/)) {
    if (isAdmin) {
      const { count } = await supabase
        .from("change_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");

      return NextResponse.json({ reply: `There are ${count ?? 0} pending change requests.` });
    }

    const { count } = await supabase
      .from("change_requests")
      .select("id", { count: "exact", head: true })
      .eq("lecturer_id", userId)
      .eq("status", "pending");

    return NextResponse.json({ reply: `You have ${count ?? 0} pending change requests.` });
  }

  if (match(normalized, /\b(notification(s)?|sms|message(s)?|sent|delivered|failed|pending)\b/)) {
    const status = match(normalized, /\bfailed\b/) ? "failed"
      : match(normalized, /\bpending\b/) ? "pending"
        : "delivered";

    const base = supabase.from("notifications");
    const query = isAdmin
      ? base.select("id", { count: "exact", head: true }).eq("status", status)
      : base.select("id", { count: "exact", head: true }).eq("lecturer_id", userId).eq("status", status);

    const { count } = await query;
    return NextResponse.json({
      reply: `There are ${count ?? 0} ${status} SMS notification${count === 1 ? "" : "s"}${isAdmin ? " in the system." : " for your account."}`
    });
  }

  if (match(normalized, /\b(lecturer(s)?|teacher(s)?|staff|users)\b/) && isAdmin) {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "lecturer");
    return NextResponse.json({ reply: `There are ${count ?? 0} registered lecturer${count === 1 ? "" : "s"} in the system.` });
  }

  return NextResponse.json({
    reply:
      "I can help with your schedule, pending change requests, and SMS notification counts. Try asking:\n" +
      "- What classes do I have today?\n" +
      "- Do I have pending change requests?\n" +
      "- How many SMS notifications have been delivered?",
  });
}
