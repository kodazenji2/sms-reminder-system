import { createClient } from "@/lib/supabase/server";
import { RequestsManager } from "@/components/lecturer/RequestsManager";
import type { TimetableEntry, ChangeRequest } from "@/types";

export const dynamic = "force-dynamic";

export default async function LecturerRequestsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: myClasses }, { data: myRequests }] = await Promise.all([
    supabase.from("timetable")
      .select("*")
      .eq("lecturer_id", user.id)
      .eq("active", true)
      .order("day_of_week").order("start_time"),
    supabase.from("change_requests")
      .select("*, timetable_entry:timetable!timetable_id(course_code, course_name, day_of_week, start_time)")
      .eq("lecturer_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <RequestsManager
      myClasses={(myClasses ?? []) as TimetableEntry[]}
      myRequests={(myRequests ?? []) as (ChangeRequest & {
        timetable_entry: { course_code: string; course_name: string; day_of_week: string; start_time: string }
      })[]}
    />
  );
}
