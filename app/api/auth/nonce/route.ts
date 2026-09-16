import { NextRequest, NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import {
  cookieOptions,
  loginMessage,
  NONCE_COOKIE,
  seal,
  requestOrigin,
  type Session,
} from "@/lib/session";
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");
  if (!address || !isAddress(address))
    return NextResponse.json(
      { error: "Invalid wallet address" },
      { status: 400 },
    );
  const session: Session = {
    address: getAddress(address),
    purpose: "nonce",
    nonce: crypto.randomUUID(),
    origin: requestOrigin(request),
    expiresAt: Date.now() + 5 * 60 * 1000,
  };
  const response = NextResponse.json({ message: loginMessage(session) });
  response.cookies.set(NONCE_COOKIE, await seal(session), {
    ...cookieOptions,
    maxAge: 300,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
