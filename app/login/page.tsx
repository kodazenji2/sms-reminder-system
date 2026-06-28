"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { NICTMBrand } from "@/components/ui/NICTMBrand";

/**
 * Lecturer / Staff Login.
 *
 * Deliberately separate from the admin login (/login/admin) for safety:
 * this page only signs in accounts with role = "lecturer". If an admin
 * account is entered here, we explicitly reject and point them to the
 * admin login rather than silently redirecting them through — keeping
 * the two entry points genuinely distinct.
 */
export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin() {
    setLoading(true);
    setError("");

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email, password,
    });

    if (authError || !data.user) {
      setError(authError?.message ?? "Login failed. Check your credentials.");
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (profile?.role === "admin") {
      // Explicitly reject — admins must use the dedicated admin login.
      await supabase.auth.signOut();
      setError("This account has administrator access. Please use the Admin Login instead.");
      setLoading(false);
      return;
    }

    router.push("/lecturer");
  }

  return (
    <div
      className="min-h-screen flex flex-col md:flex-row items-center justify-center md:items-stretch md:justify-start text-white"
      style={{ background: "radial-gradient(circle at top left, rgba(148,163,184,0.24), transparent 20%), radial-gradient(circle at bottom right, rgba(15,23,42,0.30), transparent 40%), #334155" }}
    >
      <div className="flex md:w-1/3 flex-col items-center justify-center px-6 pt-10 pb-6 md:p-10">
        <NICTMBrand size="lg" className="shadow-lg shadow-nictm-gold/30 mb-3 md:mb-4" />
        <p className="text-white font-extrabold text-xl md:text-2xl leading-tight">NICTM</p>
        <p className="text-nictm-200 text-xs md:text-sm tracking-widest uppercase mt-1">
          Uromi · Edo State
        </p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full px-6 pb-10 md:py-10">
        <div className="w-full max-w-md">
          <div className="text-center mb-8 md:mb-10">
            <h1 className="font-serif text-white text-3xl md:text-4xl leading-snug mb-2">
              SMS Timetable<br />Reminder System
            </h1>
            <p className="text-slate-300 text-sm">Lecturer Portal</p>
          </div>

          <div className="glass rounded-3xl p-6 md:p-8 shadow-2xl border-white/10">
            <h2 className="font-serif text-nictm-950 text-xl mb-6">Lecturer Sign In</h2>

            <div className="mb-4">
              <label className="label">Email Address</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                placeholder="your@nictm.edu.ng"
                autoComplete="email"
              />
            </div>

            <div className="mb-5">
              <label className="label">Password</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-2.5 rounded-xl mb-4 font-medium">
                {error}
                {error.includes("Admin Login") && (
                  <>
                    {" "}
                    <Link href="/login/admin" className="underline font-semibold">
                      Go to Admin Login →
                    </Link>
                  </>
                )}
              </div>
            )}

            <button
              className="btn-primary w-full py-3 text-base"
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? "Signing in…" : "Sign In →"}
            </button>

            
          </div>
        </div>
      </div>
    </div>
  );
}
