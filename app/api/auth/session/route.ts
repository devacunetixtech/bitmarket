import { NextRequest, NextResponse } from "next/server";
import { verifyMessage } from "viem";
import {
  cookieOptions,
  loginMessage,
  NONCE_COOKIE,
  SESSION_COOKIE,
  seal,
  unseal,
} from "@/lib/session";
function sameOrigin(request: NextRequest) {
  return request.headers.get("origin") === request.nextUrl.origin;
}
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 },
    );
  try {
    const nonce = await unseal(
      request.cookies.get(NONCE_COOKIE)?.value,
      "nonce",
    );
    const { message, signature } = await request.json();
    if (
      !nonce ||
      nonce.origin !== request.nextUrl.origin ||
      message !== loginMessage(nonce) ||
      typeof signature !== "string" ||
      !/^0x[0-9a-fA-F]{130}$/.test(signature)
    )
      return NextResponse.json(
        { error: "Sign-in expired. Connect your wallet again." },
        { status: 401 },
      );
    const valid = await verifyMessage({
      address: nonce.address,
      message,
      signature: signature as `0x${string}`,
    });
    if (!valid)
      return NextResponse.json(
        { error: "Wallet signature could not be verified" },
        { status: 401 },
      );
    const response = NextResponse.json({ address: nonce.address });
    response.cookies.set(
      SESSION_COOKIE,
      await seal({
        address: nonce.address,
        purpose: "session",
        expiresAt: Date.now() + 86400000,
      }),
      { ...cookieOptions, maxAge: 86400 },
    );
    response.cookies.set(NONCE_COOKIE, "", { ...cookieOptions, maxAge: 0 });
    return response;
  } catch {
    return NextResponse.json(
      { error: "Invalid wallet signature" },
      { status: 401 },
    );
  }
}
export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 },
    );
  const response = NextResponse.json({ ok: true });
  for (const name of [SESSION_COOKIE, NONCE_COOKIE])
    response.cookies.set(name, "", { ...cookieOptions, maxAge: 0 });
  return response;
}
