"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import { NICTMBrand } from "@/components/ui/NICTMBrand";

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

    router.push(profile?.role === "admin" ? "/admin" : "/lecturer");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-white"
      style={{ background: "radial-gradient(circle at top left, rgba(148,163,184,0.24), transparent 20%), radial-gradient(circle at bottom right, rgba(15,23,42,0.30), transparent 40%), #334155" }}>

      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-4 mb-5">
            <div className="w-12 h-12 rounded-full items-center justify-center shadow-lg shadow-nictm-gold/30 flex-shrink-0">
              <NICTMBrand />
            </div>
            <div className="text-left">
              <p className="text-white font-extrabold text-xl leading-tight">NICTM</p>
              <p className="text-nictm-200 text-xs tracking-widest uppercase mt-0.5">
                Uromi · Edo State
              </p>
            </div>
          </div>
          <h1 className="font-serif text-white text-3xl leading-snug mb-2">
            SMS Timetable<br />Reminder System
          </h1>
          <p className="text-slate-300 text-sm">Computer Science Department</p>
        </div>

        {/* Login card */}
        <div className="glass rounded-3xl p-8 shadow-2xl border-white/10">
          <h2 className="font-serif text-nictm-950 text-xl mb-6">Sign In</h2>

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
            </div>
          )}

          <button
            className="btn-primary w-full py-3 text-base"
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign In →"}
          </button>

          <p className="text-nictm-600 text-xs mt-4 text-center">
            Lecturers and administrators use the same login page.
            Your dashboard may differ with respect to your role.
          </p>
        </div>
      </div>
    </div>
  );
}
