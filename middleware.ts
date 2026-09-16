import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, unseal } from "@/lib/session";
export async function middleware(request: NextRequest) {
  const session = await unseal(
    request.cookies.get(SESSION_COOKIE)?.value,
    "session",
  );
  if (!session) {
    const url = new URL("/", request.url);
    url.searchParams.set("connect", "required");
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
export const config = { matcher: ["/app/:path*"] };
