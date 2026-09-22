import { test, after } from "node:test";
import assert from "node:assert/strict";
import {
  assertAuthConfiguration,
  AuthConfigurationError,
  seal,
  unseal,
  requestOrigin,
} from "../lib/session.ts";
const saved = {
  secret: process.env.SESSION_SECRET,
  origin: process.env.APP_ORIGIN,
  secure: process.env.AUTH_COOKIE_SECURE,
};
after(() => {
  for (const [key, value] of [
    ["SESSION_SECRET", saved.secret],
    ["APP_ORIGIN", saved.origin],
    ["AUTH_COOKIE_SECURE", saved.secure],
  ]) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
test("missing and short authentication secrets fail explicitly without a fallback", () => {
  delete process.env.SESSION_SECRET;
  assert.throws(
    assertAuthConfiguration,
    (e) =>
      e instanceof AuthConfigurationError &&
      e.code === "AUTH_SESSION_SECRET_INVALID",
  );
  process.env.SESSION_SECRET = "YOUR_GENERATED_SECRET";
  assert.throws(
    assertAuthConfiguration,
    (e) => e.code === "AUTH_SESSION_SECRET_INVALID",
  );
});
test("valid sessions are signed; forged, expired, or wrong-purpose cookies are rejected", async () => {
  process.env.SESSION_SECRET = "a".repeat(64);
  const session = {
    address: "0x1298CD7B2a8108fdA5bDcC51EB3A4fFAAa640bc7",
    purpose: "session",
    expiresAt: Date.now() + 60000,
  };
  const cookie = await seal(session);
  assert.deepEqual(await unseal(cookie, "session"), session);
  assert.equal(await unseal(cookie, "nonce"), null);
  assert.equal(await unseal(cookie + "invalid", "session"), null);
  assert.equal(
    await unseal(
      await seal({ ...session, expiresAt: Date.now() - 1000 }),
      "session",
    ),
    null,
  );
});
test("Vercel HTTPS origin comes from the actual host and invalid APP_ORIGIN is classified", () => {
  delete process.env.APP_ORIGIN;
  process.env.AUTH_COOKIE_SECURE = "true";
  const request = {
    headers: new Headers({ host: "bitmarket-six.vercel.app" }),
    nextUrl: { origin: "http://localhost:3000", protocol: "http:" },
  };
  assert.equal(requestOrigin(request), "https://bitmarket-six.vercel.app");
  for (const invalid of [
    "bitmarket-six.vercel.app",
    '"https://bitmarket-six.vercel.app"',
    "https://bitmarket-six.vercel.app/app",
  ]) {
    process.env.APP_ORIGIN = invalid;
    assert.throws(
      () => requestOrigin(request),
      (e) => e.code === "AUTH_ORIGIN_INVALID",
    );
  }
  process.env.APP_ORIGIN = " https://bitmarket-six.vercel.app ";
  assert.equal(requestOrigin(request), "https://bitmarket-six.vercel.app");
});
