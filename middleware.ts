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
  const isAdmin = path.startsWith("/admin");
  const isLecturer = path.startsWith("/lecturer");
  const isLogin = path === "/login";

  // Not logged in trying to access protected routes → login
  if (!user && (isAdmin || isLecturer)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Logged in but on login page → redirect to correct portal
  if (user && isLogin) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const dest = profile?.role === "admin" ? "/admin" : "/lecturer";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  // Role enforcement: lecturer trying to access /admin → back to /lecturer
  if (user && isAdmin) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.redirect(new URL("/lecturer", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/login",
    "/admin/:path*",
    "/lecturer/:path*",
    // Exclude cron routes — they use their own CRON_SECRET header auth
    "/((?!api/cron|_next/static|_next/image|favicon.ico).*)",
  ],
};
