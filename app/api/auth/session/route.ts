import { authFailure } from "@/lib/auth-errors";
import { NextRequest, NextResponse } from "next/server";
import { verifyMessage } from "viem";
import {
  cookieOptions,
  loginMessage,
  NONCE_COOKIE,
  SESSION_COOKIE,
  seal,
  unseal,
  requestOrigin,
  assertAuthConfiguration,
  AuthConfigurationError,
} from "@/lib/session";
function sameOrigin(request: NextRequest) {
  return request.headers.get("origin") === requestOrigin(request);
}
export async function POST(request: NextRequest) {
  try {
    assertAuthConfiguration();
    if (!sameOrigin(request))
      return NextResponse.json(
        { error: "Invalid request origin" },
        { status: 403 },
      );
    const nonce = await unseal(
      request.cookies.get(NONCE_COOKIE)?.value,
      "nonce",
    );
    const { message, signature } = await request.json();
    if (
      !nonce ||
      nonce.origin !== requestOrigin(request) ||
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
  } catch (error) {
    if (error instanceof AuthConfigurationError)
      return authFailure(error, "session");
    return NextResponse.json(
      { error: "Invalid wallet signature" },
      { status: 401 },
    );
  }
}
export async function DELETE(request: NextRequest) {
  try {
    if (!sameOrigin(request))
      return NextResponse.json(
        { error: "Invalid request origin" },
        { status: 403 },
      );
    const response = NextResponse.json({ ok: true });
    for (const name of [SESSION_COOKIE, NONCE_COOKIE])
      response.cookies.set(name, "", { ...cookieOptions, maxAge: 0 });
    return response;
  } catch (error) {
    return authFailure(error, "disconnect");
  }
}
export async function GET(request: NextRequest) {
  const session = await unseal(
    request.cookies.get(SESSION_COOKIE)?.value,
    "session",
  );
  const response = NextResponse.json(
    session
      ? { address: session.address, expiresAt: session.expiresAt }
      : { error: "Connect your wallet to continue." },
    { status: session ? 200 : 401 },
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}
