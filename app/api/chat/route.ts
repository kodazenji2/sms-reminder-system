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

function todayLabel() {
    return DAY_NAMES[new Date().getDay()];
}

function tomorrowLabel() {
    return DAY_NAMES[(new Date().getDay() + 1) % 7];
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

    if (match(normalized, /\b(class|schedule|course|lecture|lesson)\b/)) {
        const dayQuery = match(normalized, /tomorrow|next|upcoming/) ? tomorrowLabel() : day;
        const { data: classes } = await supabase
            .from("timetable")
            .select("course_code, course_name, start_time, end_time, venue")
            .eq("lecturer_id", userId)
            .eq("active", true)
            .eq("day_of_week", dayQuery)
            .order("start_time");

        if (!classes || classes.length === 0) {
            return NextResponse.json({ reply: `No active classes found for ${dayQuery}.` });
        }

        const lines = (classes as Array<Record<string, string>>).map(entry =>
            `• ${entry.course_code} ${entry.course_name} at ${entry.start_time.slice(0, 5)}${entry.venue ? `, ${entry.venue}` : ""}`
        );

        return NextResponse.json({ reply: `Your ${dayQuery} schedule:\n${lines.join("\n")}` });
    }

    if (match(normalized, /\b(change request|pending request|requests|request status)\b/)) {
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

    if (match(normalized, /\b(notification|sms|message|sent)\b/)) {
        const base = supabase.from("notifications");
        const query = isAdmin ? base : base.eq("lecturer_id", userId);
        const { count } = await query.select("id", { count: "exact", head: true }).eq("status", "delivered");
        return NextResponse.json({ reply: `There are ${count ?? 0} delivered SMS notifications${isAdmin ? " in the system." : " for your account."}` });
    }

    if (match(normalized, /\b(lecturer|teacher|staff|users)\b/) && isAdmin) {
        const { count } = await supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("role", "lecturer");
        return NextResponse.json({ reply: `There are ${count ?? 0} registered lecturers in the system.` });
    }

    return NextResponse.json({
        reply:
            "I can help with your schedule, pending change requests, and SMS notification counts. Try asking:\n" +
            "- What classes do I have today?\n" +
            "- Do I have pending change requests?\n" +
            "- How many SMS notifications have been delivered?",
    });
}
