import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/** GET  /api/admin/timetable — list all entries with lecturer info */
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("timetable")
    .select("*, lecturer:profiles!lecturer_id(id, full_name, phone, network)")
    .order("day_of_week").order("start_time");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** POST /api/admin/timetable — create a new timetable entry */
export async function POST(req: Request) {
  const supabase = await createClient();

  // Confirm caller is admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { course_code, course_name, lecturer_id, day_of_week, start_time, end_time, venue } = body;

  if (!course_code || !course_name || !lecturer_id || !day_of_week || !start_time || !end_time)
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });

  // Use admin client so we bypass RLS for the insert
  const admin = createAdminClient();
  const { data, error } = await admin.from("timetable").insert({
    course_code,
    course_name,
    lecturer_id,
    day_of_week,
    start_time,
    end_time,
    venue: venue || null,
    active: typeof body.active === "boolean" ? body.active : true,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
