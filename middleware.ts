import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(toSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — required on every request to keep auth alive
  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAdminArea   = path.startsWith("/admin");
  const isLecturerArea = path.startsWith("/lecturer");
  // Two separate login entry points
  const isStaffLogin = path === "/login";
  const isAdminLogin = path === "/login/admin";

  // Not logged in trying to access protected routes → send to the right login
  if (!user && isAdminArea) {
    return NextResponse.redirect(new URL("/login/admin", request.url));
  }
  if (!user && isLecturerArea) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Logged in but sitting on a login page → bounce to their portal
  if (user && (isStaffLogin || isAdminLogin)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const dest = profile?.role === "admin" ? "/admin" : "/lecturer";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  // Role enforcement: only admins may access /admin
  if (user && isAdminArea) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.redirect(new URL("/lecturer", request.url));
    }
  }

  // NOTE: /lecturer is intentionally NOT blocked for admins.
  // An admin who also teaches classes can switch into the lecturer
  // view via the link in the admin sidebar — see app/admin/layout.tsx.

  return response;
}

export const config = {
  matcher: [
    "/login",
    "/login/admin",
    "/admin/:path*",
    "/lecturer/:path*",
    // Exclude cron routes — they use their own CRON_SECRET header auth
    "/((?!api/cron|_next/static|_next/image|favicon.ico).*)",
  ],
};
