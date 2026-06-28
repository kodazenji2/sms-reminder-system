"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { NICTMBrand } from "@/components/ui/NICTMBrand";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types";

export function LecturerNav({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdminViewingAsLecturer = profile.role === "admin";

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push(isAdminViewingAsLecturer ? "/login/admin" : "/login");
  }

  const tabs = [
    { href: "/lecturer", label: "My Schedule" },
    { href: "/lecturer/requests", label: "Change Requests" },
    { href: "/lecturer/settings", label: "Settings" },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-4xl mx-auto px-6 md:px-8 flex items-center justify-between h-16">
        <div className="flex items-center gap-4">
          <button onClick={() => setMobileOpen(open => !open)}
            className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-white/10 text-white hover:bg-white/15 transition-colors">
            ☰
          </button>
          <NICTMBrand inverted size="sm" />
        </div>

        <nav className="hidden md:flex gap-1">
          {tabs.map(t => {
            const active = t.href === "/lecturer"
              ? pathname === "/lecturer"
              : pathname.startsWith(t.href);
            return (
              <Link key={t.href} href={t.href}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors
                  ${active ? "bg-white/12 text-white" : "text-nictm-200 hover:bg-white/5 hover:text-white"}`}>
                {t.label}
              </Link>
            );
          })}

          {isAdminViewingAsLecturer && (
            <Link href="/admin"
              title="Switch back to admin dashboard"
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors
                         text-nictm-gold hover:bg-nictm-gold-l/10 flex items-center gap-1.5">
              ⇄ Back to Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right">
            <p className="text-white text-xs font-semibold leading-tight">{profile.full_name}</p>
            <p className="text-nictm-200 text-[10px] mt-0.5">
              {isAdminViewingAsLecturer ? "Admin · Teaching View" : `${profile.network ?? ""} ${profile.phone ?? ""}`}
            </p>
          </div>
          <button onClick={handleLogout}
            className="bg-white/8 hover:bg-white/15 text-nictm-200 hover:text-white
                       text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
            Sign Out
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div className="md:hidden px-4 pb-4">
          <div className="space-y-2 rounded-3xl bg-slate-950/95 border border-white/10 p-4 shadow-xl">
            {tabs.map(t => {
              const active = t.href === "/lecturer"
                ? pathname === "/lecturer"
                : pathname.startsWith(t.href);
              return (
                <Link key={t.href} href={t.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${active
                    ? "bg-white/10 text-white"
                    : "text-nictm-200 hover:bg-white/5 hover:text-white"}`}>
                  {t.label}
                </Link>
              );
            })}

            {isAdminViewingAsLecturer && (
              <Link href="/admin"
                onClick={() => setMobileOpen(false)}
                className="block rounded-2xl px-4 py-3 text-sm font-semibold transition-colors
                           text-nictm-gold bg-nictm-gold-l/10">
                ⇄ Back to Admin
              </Link>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
