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

function tomorrowLabel() {
    return DAY_NAMES[(nowWAT().getUTCDay() + 1) % 7];
}

function match(text: string, pattern: RegExp) {
    return pattern.test(text);
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
    const day = match(normalized, /tomorrow|next day/) ? tomorrowLabel() : todayLabel();

    if (match(normalized, /\b(class(es)?|schedule(s)?|course(s)?|lecture(s)?|lesson(s)?)\b/)) {
        const dayQuery = match(normalized, /tomorrow|next|upcoming/) ? tomorrowLabel() : day;

        // FIXED: admins were filtered to lecturer_id = their own ID, so they
        // always got "no classes" even when classes existed for other lecturers.
        // Admins now see ALL active classes for the day, with lecturer name attached.
        let classesQuery = supabase
            .from("timetable")
            .select(isAdmin
                ? "course_code, course_name, start_time, end_time, venue, lecturer:profiles!lecturer_id(full_name)"
                : "course_code, course_name, start_time, end_time, venue")
            .eq("active", true)
            .eq("day_of_week", dayQuery)
            .order("start_time");

        if (!isAdmin) {
            classesQuery = classesQuery.eq("lecturer_id", userId);
        }

        const { data: classes } = await classesQuery;

        if (!classes || classes.length === 0) {
            return NextResponse.json({ reply: `No active classes found for ${dayQuery}.` });
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
                reply: `There are ${classes.length} class${classes.length === 1 ? "" : "es"} scheduled for ${dayQuery}:\n${lines.join("\n")}`
            });
        }

        const lines = (classes as Array<Record<string, string>>).map(entry =>
            `• ${entry.course_code} ${entry.course_name} at ${entry.start_time.slice(0, 5)}${entry.venue ? `, ${entry.venue}` : ""}`
        );

        return NextResponse.json({ reply: `Your ${dayQuery} schedule:\n${lines.join("\n")}` });
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
        // FIXED: the question's wording was ignored — every reply hardcoded
        // status = "delivered" even when the person explicitly asked about
        // failed or pending messages. Now the requested status is detected
        // from the message itself.
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
