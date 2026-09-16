export const SESSION_COOKIE = "bitmarket-session";
export const NONCE_COOKIE = "bitmarket-nonce";
export type Session = {
  address: `0x${string}`;
  expiresAt: number;
  purpose: "session" | "nonce";
  nonce?: string;
  origin?: string;
};
async function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("SESSION_SECRET must contain at least 32 characters");
  return crypto.subtle.importKey(
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
  return `BitMarket wallet sign-in\n\nWebsite: ${session.origin}\nWallet: ${session.address}\nChain ID: 968\nNonce: ${session.nonce}\nExpires: ${new Date(session.expiresAt).toISOString()}\n\nSign to access BitMarket. This does not authorize a transaction.`;
}
export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.AUTH_COOKIE_SECURE === "true",
};
