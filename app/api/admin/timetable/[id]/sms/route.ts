import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sendSMS, buildReminderMessage } from "@/lib/termii";

/** POST /api/admin/timetable/[id]/sms — send a manual/test SMS reminder */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const admin = createAdminClient();
  const { data: entry } = await admin
    .from("timetable")
    .select("*, lecturer:profiles!lecturer_id(id, full_name, phone)")
    .eq("id", id)
    .single();

  if (!entry) return NextResponse.json({ error: "Entry not found." }, { status: 404 });

  if (!entry.active)
    return NextResponse.json({ error: "Cannot send SMS for an inactive timetable entry." }, { status: 422 });

  const lecturer = Array.isArray(entry.lecturer) ? entry.lecturer[0] : entry.lecturer;
  if (!lecturer?.phone)
    return NextResponse.json({ error: "Lecturer has no phone number on record." }, { status: 422 });

  const message = buildReminderMessage({
    courseCode: entry.course_code,
    courseName: entry.course_name,
    startTime: entry.start_time.slice(0, 5),
    venue: entry.venue ?? "TBD",
  });

  const result = await sendSMS(lecturer.phone, message);

  // Log the attempt regardless of success
  await admin.from("notifications").insert({
    lecturer_id: lecturer.id,
    timetable_id: entry.id,
    phone: lecturer.phone,
    message,
    status: result.success ? "delivered" : "failed",
    termii_message_id: result.messageId ?? null,
    class_date: new Date().toISOString().split("T")[0],
  });

  if (!result.success)
    return NextResponse.json({ error: result.error }, { status: 502 });

  return NextResponse.json({ success: true, phone: lecturer.phone, messageId: result.messageId });
}
