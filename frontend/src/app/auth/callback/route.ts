import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    // If Supabase code is present, redirect to client to finish exchange
    return NextResponse.redirect(new URL("/?code=" + code, request.url));
  }

  // Fallback redirect
  return NextResponse.redirect(new URL("/", request.url));
}
