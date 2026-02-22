import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/agent_auth?schema=public";
process.env.TOKEN_SECRET = process.env.TOKEN_SECRET ?? "local-dev-secret-change-me-123";

const tokenService = require("./token") as typeof import("./token");

test("createToken + verifyToken returns claims for valid token", () => {
  const now = Math.floor(Date.now() / 1000);
  const token = tokenService.createToken({
    sub: "agent-1",
    tenantId: "acme",
    env: "prod",
    jti: "jti-1",
    iat: now,
    exp: now + 60
  });

  const verified = tokenService.verifyToken(token);
  assert.ok(verified);
  assert.equal(verified.sub, "agent-1");
  assert.equal(verified.tenantId, "acme");
});

test("verifyToken rejects tampered token", () => {
  const now = Math.floor(Date.now() / 1000);
  const token = tokenService.createToken({
    sub: "agent-1",
    tenantId: "acme",
    env: "prod",
    jti: "jti-2",
    iat: now,
    exp: now + 60
  });

  const tampered = `${token.slice(0, -1)}x`;
  const verified = tokenService.verifyToken(tampered);
  assert.equal(verified, null);
});

test("verifyToken rejects expired token", () => {
  const now = Math.floor(Date.now() / 1000);
  const token = tokenService.createToken({
    sub: "agent-1",
    tenantId: "acme",
    env: "prod",
    jti: "jti-3",
    iat: now - 60,
    exp: now - 1
  });

  const verified = tokenService.verifyToken(token);
  assert.equal(verified, null);
});
