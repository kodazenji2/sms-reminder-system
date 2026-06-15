import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

async function guardAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return p?.role === "admin";
}

/** PUT /api/admin/lecturers/[id] — update name, phone, network */
export async function PUT(req: Request, ctx: { params: { id: string } }) {
  if (!await guardAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const params = await ctx.params;
  const id = params.id;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  // basic UUID-ish validation
  const uuidRe = /^[0-9a-fA-F-]{36}$/;
  if (!uuidRe.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const { full_name, phone, network, active } = await req.json();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .update({ full_name, phone: phone || null, network: network || null, active })
    .eq("id", params.id)
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
