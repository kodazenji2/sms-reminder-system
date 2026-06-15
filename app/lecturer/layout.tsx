import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LecturerNav } from "@/components/lecturer/LecturerNav";

export default async function LecturerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect("/login");
  // Admins going to /lecturer get bounced back
  if (profile.role === "admin") redirect("/admin");

  return (
    <div className="min-h-screen flex flex-col">
      <LecturerNav profile={profile} />
      <main className="flex-1 p-6 md:p-8 max-w-4xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
