"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NICTMBrand } from "@/components/ui/NICTMBrand";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: "⊡" },
  { href: "/admin/timetable", label: "Timetable", icon: "⊟" },
  { href: "/admin/lecturers", label: "Lecturers", icon: "⊕" },
  { href: "/admin/notifications", label: "Notifications", icon: "⊗" },
];

interface SidebarProps {
  pendingCount: number;
  /** True if this admin also has timetable entries assigned to them */
  teachesClasses?: boolean;
}

export function Sidebar({ pendingCount, teachesClasses = false }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login/admin");
  }

  return (
    <>
      <div className="md:hidden px-4 py-3 bg-slate-950/90 border-b border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <NICTMBrand inverted size="sm" />
          <p className="text-[10px] font-bold text-nictm-200 uppercase tracking-widest">
            Admin Portal
          </p>
        </div>
        <details className="group">
          <summary className="flex items-center justify-between w-full rounded-2xl bg-slate-900/95 px-4 py-3 text-sm font-semibold text-white cursor-pointer">
            <span>Menu</span>
            <span className="text-xl">☰</span>
          </summary>
          <div className="mt-3 space-y-1">
            {NAV.map(item => {
              const active = item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href}
                  className={`block rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${active
                    ? "bg-white/10 text-white"
                    : "text-nictm-200 hover:bg-white/5 hover:text-white"}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-base opacity-80">{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    {item.label === "Notifications" && pendingCount > 0 && (
                      <span className="bg-nictm-gold text-nictm-950 text-[10px] font-extrabold rounded-full px-1.5 py-0.5 leading-none">
                        {pendingCount}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}

            {teachesClasses && (
              <Link href="/lecturer"
                className="block rounded-xl px-4 py-3 text-sm font-semibold transition-colors
                           bg-nictm-gold-l/10 text-nictm-gold hover:bg-nictm-gold-l/20">
                <div className="flex items-center gap-3">
                  <span className="text-base opacity-80">⇄</span>
                  <span className="flex-1">View Teaching Schedule</span>
                </div>
              </Link>
            )}

            <button onClick={handleLogout}
              className="w-full text-left rounded-xl px-4 py-3 text-sm font-semibold text-nictm-200 hover:bg-white/5 hover:text-white transition-colors">
              ↩ Sign Out
            </button>
          </div>
        </details>
      </div>

      <aside className="hidden md:flex w-60 bg-slate-950/90 backdrop-blur-xl border-r border-white/10 flex-col flex-shrink-0 sticky top-0 h-screen">
        {/* Brand */}
        <div className="px-5 py-6 border-b border-white/10">
          <NICTMBrand inverted size="sm" />
          <p className="text-[10px] font-bold text-nictm-200 uppercase tracking-widest mt-3">
            Admin Portal
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(item => {
            const active = item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${active
                  ? "bg-white/10 text-white"
                  : "text-nictm-200 hover:bg-white/5 hover:text-white"}`}>
                <span className="text-base opacity-80">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.label === "Notifications" && pendingCount > 0 && (
                  <span className="bg-nictm-gold text-nictm-950 text-[10px] font-extrabold rounded-full px-1.5 py-0.5 leading-none">
                    {pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Lecturer-view switch + logout */}
        <div className="px-3 py-4 border-t border-white/10 space-y-1">
          {teachesClasses && (
            <Link href="/lecturer"
              title="Switch to your lecturer dashboard"
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-semibold
                         text-nictm-gold hover:bg-nictm-gold-l/10 rounded-xl transition-colors">
              <span className="text-base opacity-80">⇄</span>
              View Teaching Schedule
            </Link>
          )}
          <button onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-semibold text-nictm-200 hover:text-white hover:bg-white/5 rounded-xl transition-colors">
            ↩ Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
