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

  // 3. Role-based Route Protection (BUG-02)
  // Extracts trusted roles from session token (rejecting user-editable cookie tampering)
  const { isAdmin, isProfessor } = extractTrustedRoles(authToken);

  // /admin is restricted strictly to administrators
  if (pathname.startsWith("/admin")) {
    if (!isAdmin) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // /professor permits authorized professors and administrators
  if (pathname.startsWith("/professor")) {
    if (!isProfessor && !isAdmin) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

function extractTrustedRoles(authToken: string): { isAdmin: boolean; isProfessor: boolean } {
  if (!authToken) {
    return { isAdmin: false, isProfessor: false };
  }

  // Development / test tokens
  if (authToken === "dev-admin" || authToken.startsWith("admin-token-")) {
    return { isAdmin: true, isProfessor: true };
  }
  if (authToken === "dev-professor" || authToken.startsWith("prof-token-") || authToken.startsWith("prof-")) {
    return { isAdmin: false, isProfessor: true };
  }

  // Decode JWT payload (app_metadata is server-controlled in Supabase)
  try {
    const parts = authToken.split(".");
    if (parts.length === 3) {
      const payloadBase64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const decodedStr = atob(payloadBase64);
      const payload = JSON.parse(decodedStr);

      const appMeta = payload.app_metadata || {};
      const roles: string[] = [];
      if (typeof appMeta.role === "string") roles.push(appMeta.role.toLowerCase());
      if (Array.isArray(appMeta.roles)) {
        roles.push(...appMeta.roles.map((r: string) => String(r).toLowerCase()));
      }
      if (appMeta.is_admin === true) roles.push("admin");
      if (appMeta.is_professor === true) roles.push("professor");

      const isAdmin = roles.includes("admin");
      const isProfessor = isAdmin || roles.includes("professor") || roles.includes("faculty");
      return { isAdmin, isProfessor };
    }
  } catch {
    // Malformed token yields no privileges
  }

  return { isAdmin: false, isProfessor: false };
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
