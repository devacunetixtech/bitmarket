export const SESSION_COOKIE = "bitmarket-session";
export const NONCE_COOKIE = "bitmarket-nonce";
export type Session = {
  address: `0x${string}`;
  expiresAt: number;
  purpose: "session" | "nonce";
  nonce?: string;
  origin?: string;
};
export class AuthConfigurationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "AuthConfigurationError";
  }
}
export function assertAuthConfiguration() {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret || secret.length < 32)
    throw new AuthConfigurationError(
      "AUTH_SESSION_SECRET_INVALID",
      "Wallet sign-in is unavailable: SESSION_SECRET must be configured with at least 32 characters in the server deployment environment.",
    );
  if (!globalThis.crypto?.subtle)
    throw new AuthConfigurationError(
      "AUTH_CRYPTO_UNAVAILABLE",
      "Wallet sign-in requires a server runtime with Web Crypto support. Use Node.js 22 or newer.",
    );
  return secret;
}
async function key() {
  const secret = assertAuthConfiguration();
  return globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
const encode = (s: string) =>
  btoa(s).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
const decode = (s: string) => atob(s.replaceAll("-", "+").replaceAll("_", "/"));
export async function seal(session: Session) {
  const payload = encode(JSON.stringify(session));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await key(),
    new TextEncoder().encode(payload),
  );
  return `${payload}.${encode(String.fromCharCode(...new Uint8Array(signature)))}`;
}
export async function unseal(
  value: string | undefined,
  purpose: Session["purpose"],
): Promise<Session | null> {
  try {
    if (!value) return null;
    const [payload, signature, ...extra] = value.split(".");
    if (extra.length || !signature) return null;
    const ok = await crypto.subtle.verify(
      "HMAC",
      await key(),
      Uint8Array.from(decode(signature), (c) => c.charCodeAt(0)),
      new TextEncoder().encode(payload),
    );
    if (!ok) return null;
    const parsed = JSON.parse(decode(payload));
    return parsed.purpose === purpose &&
      parsed.expiresAt > Date.now() &&
      /^0x[a-fA-F0-9]{40}$/.test(parsed.address)
      ? parsed
      : null;
  } catch {
    return null;
  }
}
export function loginMessage(session: Session) {
  return `BitMarket wallet sign-in\n\nWebsite: ${session.origin}\nWallet: ${session.address}\nChain ID: 677\nNonce: ${session.nonce}\nExpires: ${new Date(session.expiresAt).toISOString()}\n\nSign to access BitMarket. This does not authorize a transaction.`;
}
export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.AUTH_COOKIE_SECURE === "true",
};
// Next.js may normalize nextUrl to localhost; bind signatures to the actual request host.
export function requestOrigin(request: {
  headers: Headers;
  nextUrl: { origin: string; protocol: string };
}) {
  const configured = process.env.APP_ORIGIN?.trim();
  if (configured) {
    try {
      const origin = new URL(configured);
      if (
        !["https:", "http:"].includes(origin.protocol) ||
        origin.username ||
        origin.password ||
        origin.pathname !== "/" ||
        origin.search ||
        origin.hash
      )
        throw new Error();
      return origin.origin;
    } catch {
      throw new AuthConfigurationError(
        "AUTH_ORIGIN_INVALID",
        "Wallet sign-in is unavailable: APP_ORIGIN must be a complete website origin such as https://bitmarket-six.vercel.app, without a path or quotation marks. It can also be left unset.",
      );
    }
  }
  const host = request.headers.get("host");
  if (!host || !/^[a-zA-Z0-9.:[\]-]+$/.test(host))
    throw new Error("Invalid request host");
  return `${process.env.AUTH_COOKIE_SECURE === "true" ? "https:" : request.nextUrl.protocol}//${host}`;
}
