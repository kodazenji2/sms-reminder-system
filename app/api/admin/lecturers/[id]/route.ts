import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { phoneToPseudoEmail } from "@/lib/auth/identifiers";

async function guardAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return p?.role === "admin";
}

/** PUT /api/admin/lecturers/[id] — update name, phone, email, network */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!await guardAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const params = await ctx.params;
  const id = params.id;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  // basic UUID-ish validation
  const uuidRe = /^[0-9a-fA-F-]{36}$/;
  if (!uuidRe.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const { full_name, phone, email, network, active } = await req.json();
  const admin = createAdminClient();

  const normalizedEmail = (email ?? "").trim();
  const fallbackEmail = phoneToPseudoEmail(phone || "");
  const authEmail = normalizedEmail || fallbackEmail;

  if (authEmail) {
    const { data: existingUser, error: fetchUserError } = await admin.auth.admin.getUserById(id);
    if (fetchUserError) return NextResponse.json({ error: fetchUserError.message }, { status: 500 });

    if (existingUser.user?.email !== authEmail) {
      const { error: authUpdateError } = await admin.auth.admin.updateUserById(id, {
        email: authEmail,
        email_confirm: true,
      });

      if (authUpdateError) {
        return NextResponse.json({ error: authUpdateError.message }, { status: 500 });
      }
    }
  }

  const { data, error } = await admin
    .from("profiles")
    .update({
      full_name,
      phone: phone || null,
      email: authEmail || null,
      network: network || null,
      active,
    })
    .eq("id", id)
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
