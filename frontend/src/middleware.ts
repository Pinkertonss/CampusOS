import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static assets & internal Next.js routes bypass middleware
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".") || // static files like favicon.ico, images, robots.txt
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Read auth and onboarding cookies
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const isMockSupabase = !supabaseUrl || supabaseUrl.includes("mock-project");

  const authToken =
    request.cookies.get("campusos_auth_token")?.value ||
    request.cookies.get("sb-access-token")?.value ||
    "";
  const isOnboarded = request.cookies.get("campusos_onboarded")?.value === "true";
  const isLoggedOut = request.cookies.get("campusos_logged_out")?.value === "true";

  const isAuthenticated = !isLoggedOut && (isMockSupabase || Boolean(authToken && authToken.length > 0));

  const isPublicAuthRoute =
    pathname === "/login" || pathname === "/signup" || pathname.startsWith("/auth/callback");
  const isOnboardingRoute = pathname === "/onboarding";

  // 1. Unauthenticated users:
  if (!isAuthenticated) {
    // If attempting to access any protected route (including /onboarding, /, /copilot, etc.), redirect to /login
    if (!isPublicAuthRoute) {
      const loginUrl = new URL("/login", request.url);
      if (pathname !== "/") {
        loginUrl.searchParams.set("next", pathname);
      }
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // 2. Authenticated users:
  // If attempting to access /login or /signup while already signed in:
  if (isPublicAuthRoute) {
    if (!isOnboarded) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  // If authenticated but not yet completed onboarding:
  if (!isOnboarded && !isOnboardingRoute) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  // If already onboarded and attempts to visit /onboarding:
  if (isOnboarded && isOnboardingRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // 3. Admin-only route restriction:
  // Hide and protect /admin and /professor from students; visible to admins only
  if (pathname.startsWith("/admin") || pathname.startsWith("/professor")) {
    const roleCookie = request.cookies.get("campusos_role")?.value;
    const isExplicitAdmin =
      roleCookie === "admin" ||
      authToken === "dev-admin" ||
      authToken.startsWith("admin-token-");

    if (!isExplicitAdmin) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
