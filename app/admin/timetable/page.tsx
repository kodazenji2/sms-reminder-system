import { createClient } from "@/lib/supabase/server";
import { TimetableManager } from "@/components/admin/TimetableManager";
import type { TimetableEntry, Profile } from "@/types";

export const dynamic = "force-dynamic";

export default async function TimetablePage() {
  const supabase = await createClient();

  const [{ data: entries }, { data: lecturers }] = await Promise.all([
    supabase.from("timetable")
      .select("*, lecturer:profiles!lecturer_id(id, full_name, phone, network)")
      .eq("active", true)
      .order("day_of_week").order("start_time"),
    supabase.from("profiles")
      .select("id, full_name, phone, network")
      .eq("role", "lecturer")
      .order("full_name"),
  ]);

  return (
    <TimetableManager
      initialEntries={(entries ?? []) as (TimetableEntry & { lecturer: Profile })[]}
      lecturers={(lecturers ?? []) as Profile[]}
    />
  );
}
