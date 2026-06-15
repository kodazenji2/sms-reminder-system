import { createClient } from "@/lib/supabase/server";
import { NotificationsManager } from "@/components/admin/NotificationsManager";
import type { Notification, ChangeRequest, Profile } from "@/types";

export default async function NotificationsPage() {
  const supabase = await createClient();

  const [{ data: notifs }, { data: requests }] = await Promise.all([
    supabase.from("notifications")
      .select("*, lecturer:profiles!lecturer_id(id, full_name, phone)")
      .order("sent_at", { ascending: false })
      .limit(100),
    supabase.from("change_requests")
      .select("*, lecturer:profiles!lecturer_id(id, full_name), timetable_entry:timetable!timetable_id(course_code, course_name, day_of_week, start_time)")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <NotificationsManager
      notifications={(notifs ?? []) as (Notification & { lecturer: Profile })[]}
      requests={(requests ?? []) as (ChangeRequest & { lecturer: Profile })[]}
    />
  );
}
