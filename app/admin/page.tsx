import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import type { TimetableEntry, Notification, ChangeRequest, Profile } from "@/types";

// Simulate "today" as a day label matching timetable day_of_week values
function getTodayLabel(): string {
  return ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date().getDay()];
}

export default async function AdminDashboard() {
  const supabase = await createClient();
  const today    = getTodayLabel();

  const [
    { count: lecturerCount },
    { data: todayClasses   },
    { data: recentNotifs   },
    { data: allRequests    },
    { count: pendingCount  },
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "lecturer"),
    supabase.from("timetable")
      .select("*, lecturer:profiles!lecturer_id(full_name)")
      .eq("day_of_week", today).eq("active", true).order("start_time"),
    supabase.from("notifications")
      .select("*, lecturer:profiles!lecturer_id(full_name, phone)")
      .order("sent_at", { ascending: false }).limit(8),
    supabase.from("change_requests")
      .select("*, lecturer:profiles!lecturer_id(full_name)")
      .order("created_at", { ascending: false }).limit(10),
    supabase.from("change_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  const deliveredThisWeek = (recentNotifs as Notification[] ?? []).filter(n => n.status === "delivered").length;

  return (
    <div className="space-y-7">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard label="Total Lecturers"    value={lecturerCount ?? 0}   sub="Registered in system"    />
        <StatCard label="Classes Today"      value={(todayClasses as TimetableEntry[])?.length ?? 0}  sub={today} accent />
        <StatCard label="SMS (Recent)"       value={deliveredThisWeek}    sub="Delivered notifications" gold />
        <StatCard label="Pending Requests"   value={pendingCount ?? 0}    sub="Awaiting your review"    accent={!!pendingCount} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Today's classes */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-nictm-950">Today&apos;s Classes</h3>
            <span className="text-xs text-nictm-600">{today}</span>
          </div>
          <div className="divide-y divide-nictm-50">
            {!(todayClasses as TimetableEntry[])?.length && (
              <p className="px-6 py-5 text-sm text-nictm-600">No classes scheduled today.</p>
            )}
            {(todayClasses as (TimetableEntry & { lecturer: { full_name: string } })[])?.map(entry => (
              <div key={entry.id} className="flex gap-3 px-6 py-3 items-start">
                <div className="bg-nictm-50 rounded-lg px-3 py-2 text-center min-w-[58px] flex-shrink-0">
                  <p className="text-nictm-800 font-bold text-sm">{entry.start_time.slice(0, 5)}</p>
                  <p className="text-nictm-600 text-[10px]">{entry.venue ?? "—"}</p>
                </div>
                <div>
                  <p className="font-semibold text-nictm-950 text-sm">{entry.course_name}</p>
                  <p className="text-nictm-600 text-xs mt-0.5">
                    {entry.course_code} · {entry.lecturer?.full_name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent SMS */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-nictm-950">Recent SMS Sent</h3>
          </div>
          <div className="divide-y divide-nictm-50">
            {!(recentNotifs as Notification[])?.length && (
              <p className="px-6 py-5 text-sm text-nictm-600">No messages sent yet.</p>
            )}
            {(recentNotifs as (Notification & { lecturer: Profile })[])?.map(n => (
              <div key={n.id} className="flex items-center gap-3 px-6 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-nictm-950 truncate">{n.lecturer?.full_name}</p>
                  <p className="text-xs text-nictm-600">{new Date(n.sent_at).toLocaleString("en-NG")}</p>
                </div>
                <Badge status={n.status} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Change requests */}
      {(allRequests as ChangeRequest[])?.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-nictm-950">Change Requests</h3>
            <span className="text-xs text-nictm-600">
              {pendingCount} pending · Review in <a href="/admin/notifications" className="text-nictm-700 underline">Notifications</a>
            </span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Lecturer</th><th>Reason</th><th>Requested Date</th><th>Submitted</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(allRequests as (ChangeRequest & { lecturer: Profile })[]).map(r => (
                <tr key={r.id}>
                  <td className="font-semibold text-nictm-950">{r.lecturer?.full_name}</td>
                  <td className="text-nictm-700 max-w-[240px] truncate">{r.reason}</td>
                  <td className="text-nictm-700">{r.requested_date ?? "—"}</td>
                  <td className="text-nictm-600 text-xs">{new Date(r.created_at).toLocaleDateString("en-NG")}</td>
                  <td><Badge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
