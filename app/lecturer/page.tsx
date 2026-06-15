import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/ui/StatCard";
import { ChatAssistant } from "@/components/ui/ChatAssistant";
import type { TimetableEntry, ChangeRequest } from "@/types";

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export default async function LecturerSchedulePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: entries }, { data: requests }, { data: profile }] = await Promise.all([
    supabase.from("timetable")
      .select("*")
      .eq("lecturer_id", user.id)
      .eq("active", true)
      .order("start_time"),
    supabase.from("change_requests")
      .select("id, status")
      .eq("lecturer_id", user.id),
    supabase.from("profiles")
      .select("full_name, phone, network")
      .eq("id", user.id)
      .single(),
  ]);

  const classes = (entries ?? []) as TimetableEntry[];
  const reqs = (requests ?? []) as ChangeRequest[];
  const pendingReqs = reqs.filter(r => r.status === "pending").length;

  // Group by day, sorted in week order
  const byDay: Record<string, TimetableEntry[]> = {};
  classes.forEach(e => {
    if (!byDay[e.day_of_week]) byDay[e.day_of_week] = [];
    byDay[e.day_of_week].push(e);
  });

  return (
    <div>
      <div className="mb-7">
        <h1 className="font-serif text-nictm-950 text-3xl mb-1">My Teaching Schedule</h1>
        <p className="text-nictm-600 text-sm">
          SMS reminders are sent automatically according to your preferences before each class
          to <strong>{profile?.phone ?? "your registered phone"}</strong> ({profile?.network ?? "your network"}).
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Classes This Week" value={classes.length} sub="Across all days" />
        <StatCard label="Pending Requests" value={pendingReqs} sub="Awaiting approval" accent={pendingReqs > 0} />
        <StatCard label="SMS Reminders" value={classes.length} sub="Auto-scheduled" gold />
      </div>

      <div className="mb-10">
        <p className="text-nictm-600 text-sm">
          Tap the floating chat button in the bottom-right corner to ask the assistant about your schedule and requests.
        </p>
      </div>

      <ChatAssistant />

      {classes.length === 0 && (
        <div className="card p-10 text-center text-nictm-600">
          No classes have been assigned to your account yet.
          Contact the department administrator.
        </div>
      )}

      {DAY_ORDER.filter(d => byDay[d]).map(day => (
        <div key={day} className="mb-7">
          {/* Day header */}
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-extrabold text-nictm-800 uppercase tracking-widest">{day}</span>
            <div className="flex-1 h-px bg-nictm-100" />
            <span className="text-xs text-nictm-500">{byDay[day].length} class{byDay[day].length > 1 ? "es" : ""}</span>
          </div>

          <div className="space-y-3">
            {byDay[day].sort((a, b) => a.start_time.localeCompare(b.start_time)).map(entry => (
              <div key={entry.id} className="card flex items-center gap-5 px-6 py-4">
                {/* Time block */}
                <div className="bg-nictm-50 rounded-xl px-4 py-3 text-center min-w-[70px] flex-shrink-0">
                  <p className="text-nictm-800 font-extrabold text-lg leading-none">
                    {entry.start_time.slice(0, 5)}
                  </p>
                  <p className="text-nictm-500 text-[10px] mt-1">{entry.end_time.slice(0, 5)}</p>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-nictm-950 text-base leading-tight">{entry.course_name}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className="bg-nictm-50 text-nictm-800 text-xs font-extrabold
                                     px-2 py-0.5 rounded-md">{entry.course_code}</span>
                    <span className="text-nictm-600 text-xs">Venue: {entry.venue ?? "TBD"}</span>
                  </div>
                </div>

                {/* Reminder badge */}
                <span className="bg-nictm-gold-l text-nictm-gold text-xs font-bold
                                 px-3 py-1.5 rounded-xl flex-shrink-0 hidden sm:inline-flex items-center gap-1">
                  📱 Reminder set
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
