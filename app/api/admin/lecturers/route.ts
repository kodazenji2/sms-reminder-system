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

/** GET /api/admin/lecturers */
export async function GET() {
  if (!await guardAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles").select("*").eq("role", "lecturer").order("full_name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/**
 * POST /api/admin/lecturers
 * Creates a Supabase Auth user then updates their profile with role=lecturer.
 * Requires SUPABASE_SERVICE_ROLE_KEY (admin client).
 */
export async function POST(req: Request) {
  if (!await guardAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { full_name, email, password, phone, network } = await req.json();

  if (!full_name || !password || (!email && !phone))
    return NextResponse.json({ error: "full_name, password, and either an email or phone number are required." }, { status: 400 });

  const normalizedEmail = (email || phoneToPseudoEmail(phone)).trim();

  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return NextResponse.json({ error: "A valid email address or phone number is required." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Create auth user with the service role — this also fires the handle_new_user trigger
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,         // Skip email verification for staff accounts
    user_metadata: { full_name },
  });

  if (authError || !created.user)
    return NextResponse.json({ error: authError?.message ?? "Failed to create auth user." }, { status: 500 });

  // Update the profile (trigger already inserted a row; we just fill in the extra fields)
  const { data, error: profileError } = await admin
    .from("profiles")
    .update({ full_name, phone: phone || null, network: network || null, role: "lecturer" })
    .eq("id", created.user.id)
    .select()
    .single();

  if (profileError)
    return NextResponse.json({ error: profileError.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
