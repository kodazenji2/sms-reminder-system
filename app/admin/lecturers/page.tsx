import { createClient } from "@/lib/supabase/server";
import { LecturersManager } from "@/components/admin/LecturersManager";
import type { Profile, TimetableEntry } from "@/types";

export const dynamic = "force-dynamic";

export default async function LecturersPage() {
  const supabase = await createClient();
  const [{ data: lecturers }, { data: timetable }] = await Promise.all([
    supabase.from("profiles").select("*").eq("role", "lecturer").order("full_name"),
    supabase.from("timetable").select("id, lecturer_id").eq("active", true),
  ]);

  // Count classes per lecturer
  const classCounts: Record<string, number> = {};
  (timetable as TimetableEntry[] ?? []).forEach(e => {
    classCounts[e.lecturer_id] = (classCounts[e.lecturer_id] ?? 0) + 1;
  });

  return (
    <LecturersManager
      initialLecturers={(lecturers ?? []) as Profile[]}
      classCounts={classCounts}
    />
  );
}
