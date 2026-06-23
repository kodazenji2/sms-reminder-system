import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const VALID_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

/** GET /api/lecturer/requests — fetch own requests */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  // RLS restricts to own rows automatically via anon client
  const { data, error } = await supabase
    .from("change_requests")
    .select("*, timetable_entry:timetable!timetable_id(course_code, course_name, day_of_week, start_time)")
    .eq("lecturer_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** POST /api/lecturer/requests — submit a new change request */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const {
    timetable_id,
    reason,
    request_type,
    requested_date,
    requested_day_of_week,
    requested_start_time,
  } = await req.json();

  if (!timetable_id || !reason?.trim())
    return NextResponse.json({ error: "timetable_id and reason are required." }, { status: 400 });

  const type = request_type === "permanent" ? "permanent" : "one_off";

  if (type === "permanent") {
    if (!requested_day_of_week || !VALID_DAYS.includes(requested_day_of_week) || !requested_start_time) {
      return NextResponse.json(
        { error: "A permanent change requires a valid day of week and a new time." },
        { status: 400 }
      );
    }
  }

  // Verify the timetable entry belongs to this lecturer (prevents spoofing another ID)
  const { data: entry } = await supabase
    .from("timetable")
    .select("id")
    .eq("id", timetable_id)
    .eq("lecturer_id", user.id)
    .single();

  if (!entry)
    return NextResponse.json({ error: "Class not found or does not belong to you." }, { status: 404 });

  // Use admin client for the insert — RLS insert policy requires lecturer_id = auth.uid()
  // but we're on the server so we use service role after the ownership check above
  const admin = createAdminClient();
  const { data, error } = await admin.from("change_requests").insert({
    lecturer_id:            user.id,
    timetable_id,
    reason:                 reason.trim(),
    request_type:           type,
    requested_date:         type === "one_off" ? (requested_date || null) : null,
    requested_day_of_week:  type === "permanent" ? requested_day_of_week : null,
    requested_start_time:   type === "permanent" ? requested_start_time : null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
