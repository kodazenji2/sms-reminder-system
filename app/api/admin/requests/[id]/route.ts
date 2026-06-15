import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

async function guardAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return p?.role === "admin";
}

/** PUT /api/admin/requests/[id] — approve or reject */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  if (!await guardAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { status, admin_note } = await req.json();
  if (!["approved", "rejected"].includes(status))
    return NextResponse.json({ error: "status must be 'approved' or 'rejected'." }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("change_requests")
    .update({ status, admin_note: admin_note || null })
    .eq("id", params.id)
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
