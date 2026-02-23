import assert from "node:assert/strict";
import test from "node:test";
import { ensureDatabaseReady, request, resetDatabase } from "../test/testUtils";

test("token key rotation endpoint activates new kid", async (t) => {
  if (!(await ensureDatabaseReady())) {
    t.skip("Database not available for token security test");
    return;
  }

  await resetDatabase();

  const createKey = await request.post("/v1/tokens/keys").send({
    kid: "rotation-test-kid",
    secret: "rotation-secret-key-123456",
    activate: true
  });
  assert.equal(createKey.status, 201);

  const listKeys = await request.get("/v1/tokens/keys");
  assert.equal(listKeys.status, 200);
  const active = (listKeys.body.keys as Array<{ kid: string; isActive: boolean }>).find((key) => key.isActive);
  assert.ok(active);
  assert.equal(active?.kid, "rotation-test-kid");
});

test("revoked token is blocked on proxy", async (t) => {
  if (!(await ensureDatabaseReady())) {
    t.skip("Database not available for token security test");
    return;
  }

  await resetDatabase();

  const createAgent = await request.post("/v1/agents").send({
    tenantId: "acme",
    name: "security-agent",
    environment: "prod"
  });
  const agentId = createAgent.body.id as string;

  const mintToken = await request.post("/v1/tokens/mint").send({ tenantId: "acme", agentId });
  assert.equal(mintToken.status, 200);
  const token = mintToken.body.token as string;

  const revoke = await request.post("/v1/tokens/revoke").send({ tenantId: "acme", token, reason: "suspicious_activity" });
  assert.equal(revoke.status, 200);

  const proxy = await request
    .post("/v1/proxy/github/read_pr")
    .set("authorization", `Bearer ${token}`)
    .send({ environment: "prod", payload: { owner: "acme", repo: "api", pull_number: 1 } });

  assert.equal(proxy.status, 401);
  assert.equal(proxy.body.code, "INVALID_TOKEN_REVOKED");
});

test("tenant token ttl override changes minted expiry", async (t) => {
  if (!(await ensureDatabaseReady())) {
    t.skip("Database not available for token security test");
    return;
  }

  await resetDatabase();

  const createAgent = await request.post("/v1/agents").send({
    tenantId: "acme",
    name: "ttl-agent",
    environment: "prod"
  });
  const agentId = createAgent.body.id as string;

  const setConfig = await request.post("/v1/tenants/config").send({
    tenantId: "acme",
    tokenTtlSeconds: 1200
  });
  assert.equal(setConfig.status, 200);

  const mintToken = await request.post("/v1/tokens/mint").send({ tenantId: "acme", agentId });
  assert.equal(mintToken.status, 200);
  assert.equal(mintToken.body.expiresInSeconds, 1200);
});
