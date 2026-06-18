import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

async function guardAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  return profile?.role === "admin" ? user : null;
}

/** PUT /api/admin/timetable/[id] — update entry */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!await guardAdmin())
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const params = await ctx.params;
  const body = await req.json();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("timetable")
    .update({
      course_code: body.course_code,
      course_name: body.course_name,
      lecturer_id: body.lecturer_id,
      day_of_week: body.day_of_week,
      start_time: body.start_time,
      end_time: body.end_time,
      venue: body.venue || null,
      active: typeof body.active === "boolean" ? body.active : true,
    })
    .eq("id", params.id)
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** PATCH /api/admin/timetable/[id] — toggle active status */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!await guardAdmin())
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const params = await ctx.params;
  const body = await req.json();
  if (typeof body.active !== "boolean")
    return NextResponse.json({ error: "Missing active boolean." }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("timetable")
    .update({ active: body.active })
    .eq("id", params.id)
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** DELETE /api/admin/timetable/[id] — soft-delete by setting active=false */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!await guardAdmin())
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const params = await ctx.params;

  const admin = createAdminClient();
  const { error } = await admin
    .from("timetable")
    .update({ active: false })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
