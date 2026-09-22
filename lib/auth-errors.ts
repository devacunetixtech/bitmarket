import { NextResponse } from "next/server";
import { AuthConfigurationError } from "./session";
export function authFailure(error: unknown, route: string) {
  const configuration = error instanceof AuthConfigurationError;
  const code = configuration ? error.code : "AUTH_INTERNAL_ERROR";
  // Log a diagnosis, never environment values, signatures, cookies, or raw exceptions.
  console.error("[BitMarket authentication]", {
    route,
    code,
    errorType: error instanceof Error ? error.name : "UnknownError",
  });
  const response = NextResponse.json(
    {
      code,
      error: configuration
        ? error.message
        : "Wallet sign-in is temporarily unavailable. Check the authentication function in Vercel Logs.",
    },
    { status: configuration ? 503 : 500 },
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}
