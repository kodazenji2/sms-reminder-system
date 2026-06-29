import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/admin/Sidebar";
import { ChatAssistant } from "@/components/ui/ChatAssistant";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login/admin");

  // Confirm admin role
  const { data: profile } = await supabase
    .from("profiles").select("role, full_name, email").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/lecturer");

  // Pending change requests count for sidebar badge
  const { count } = await supabase
    .from("change_requests").select("id", { count: "exact", head: true }).eq("status", "pending");

  // Does this admin ALSO teach classes? If they have any timetable
  // entries assigned to them, show the "View Teaching Schedule" switch.
  const { count: teachingCount } = await supabase
    .from("timetable")
    .select("id", { count: "exact", head: true })
    .eq("lecturer_id", user.id)
    .eq("active", true);

  const teachesClasses = (teachingCount ?? 0) > 0;

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <Sidebar pendingCount={count ?? 0} teachesClasses={teachesClasses} />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-nictm-100 px-8 py-4 flex items-center justify-between sticky top-0 z-40">
          <div>
            <h1 className="font-serif text-nictm-950 text-xl leading-tight">
              Administration Portal
            </h1>
            <p className="text-nictm-600 text-xs mt-0.5">
              Computer Science Department · NICTM Uromi
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-nictm-800 flex items-center justify-center
                            text-white font-bold text-sm">
              {profile?.full_name?.charAt(0) ?? "A"}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-nictm-950 leading-tight">{profile?.full_name}</p>
              <p className="text-xs text-nictm-600">{profile?.email}</p>
            </div>
          </div>
        </header>

        <main className="flex-1 p-8 overflow-auto">{children}</main>
      </div>

      {/* Floating assistant — same component as lecturer view.
          The /api/chat route already branches on isAdmin to return
          system-wide counts (all pending requests, all delivered SMS,
          total lecturer count) instead of per-lecturer figures. */}
      <ChatAssistant />
    </div>
  );
}
