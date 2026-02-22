import assert from "node:assert/strict";
import test from "node:test";
import { ensureDatabaseReady, request, resetDatabase, withMockedFetch } from "../test/testUtils";

function jsonResponse(body: Record<string, unknown>, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...(headers ?? {})
    }
  });
}

test("e2e allow flow succeeds through proxy", async (t) => {
  if (!(await ensureDatabaseReady())) {
    t.skip("Database not available for e2e test");
    return;
  }
  await resetDatabase();

  const restoreFetch = withMockedFetch(async (input) => {
    const url = String(input);
    if (url.includes("/chat.postMessage")) {
      return jsonResponse({ ok: true, channel: "C1", ts: "123.456" });
    }

    return jsonResponse({ ok: true });
  });

  try {
    const createAgent = await request.post("/v1/agents").send({ tenantId: "acme", name: "agent", environment: "prod" });
    const agentId = createAgent.body.id as string;

    await request.post("/v1/connectors/slack/credentials").send({ tenantId: "acme", token: "xoxb-tenant-token" });

    await request.post("/v1/policies").send({
      tenantId: "acme",
      agentId,
      connector: "slack",
      actions: ["post_message"],
      environment: "prod",
      effect: "allow"
    });

    const tokenRes = await request.post("/v1/tokens/mint").send({ tenantId: "acme", agentId });
    const token = tokenRes.body.token as string;

    const proxyRes = await request
      .post("/v1/proxy/slack/post_message")
      .set("authorization", `Bearer ${token}`)
      .send({ payload: { channel: "C1", text: "hello" }, environment: "prod" });

    assert.equal(proxyRes.status, 200);
    assert.equal(proxyRes.body.decision, "allow");
  } finally {
    restoreFetch();
  }
});

test("e2e deny flow blocks request", async (t) => {
  if (!(await ensureDatabaseReady())) {
    t.skip("Database not available for e2e test");
    return;
  }
  await resetDatabase();

  const createAgent = await request.post("/v1/agents").send({ tenantId: "acme", name: "agent", environment: "prod" });
  const agentId = createAgent.body.id as string;

  await request.post("/v1/policies").send({
    tenantId: "acme",
    agentId,
    connector: "slack",
    actions: ["post_message"],
    environment: "prod",
    effect: "deny"
  });

  const tokenRes = await request.post("/v1/tokens/mint").send({ tenantId: "acme", agentId });
  const token = tokenRes.body.token as string;

  const proxyRes = await request
    .post("/v1/proxy/slack/post_message")
    .set("authorization", `Bearer ${token}`)
    .send({ payload: { channel: "C1", text: "blocked" }, environment: "prod" });

  assert.equal(proxyRes.status, 403);
  assert.equal(proxyRes.body.decision, "deny");
});

test("e2e approval flow supports replay once and blocks reuse", async (t) => {
  if (!(await ensureDatabaseReady())) {
    t.skip("Database not available for e2e test");
    return;
  }
  await resetDatabase();

  const restoreFetch = withMockedFetch(async (input) => {
    const url = String(input);
    if (url.includes("/chat.postMessage")) {
      return jsonResponse({ ok: true, channel: "C1", ts: "123.456" });
    }

    return jsonResponse({ ok: true });
  });

  try {
    const createAgent = await request.post("/v1/agents").send({ tenantId: "acme", name: "agent", environment: "prod" });
    const agentId = createAgent.body.id as string;

    await request.post("/v1/connectors/slack/credentials").send({ tenantId: "acme", token: "xoxb-tenant-token" });

    await request.post("/v1/policies").send({
      tenantId: "acme",
      agentId,
      connector: "slack",
      actions: ["post_message"],
      environment: "prod",
      effect: "require_approval"
    });

    const tokenRes = await request.post("/v1/tokens/mint").send({ tenantId: "acme", agentId });
    const token = tokenRes.body.token as string;

    const firstProxy = await request
      .post("/v1/proxy/slack/post_message")
      .set("authorization", `Bearer ${token}`)
      .send({ payload: { channel: "C1", text: "needs approval" }, environment: "prod" });

    assert.equal(firstProxy.status, 202);
    const approvalId = firstProxy.body.approval.id as string;

    const decisionRes = await request.post(`/v1/approvals/${approvalId}/decision`).send({
      tenantId: "acme",
      approverId: "sec-lead-1",
      decision: "approved"
    });
    assert.equal(decisionRes.status, 200);

    const replayOnce = await request
      .post("/v1/proxy/slack/post_message")
      .set("authorization", `Bearer ${token}`)
      .send({
        approvalId,
        payload: { channel: "C1", text: "approved" },
        environment: "prod"
      });
    assert.equal(replayOnce.status, 200);

    const replayTwice = await request
      .post("/v1/proxy/slack/post_message")
      .set("authorization", `Bearer ${token}`)
      .send({
        approvalId,
        payload: { channel: "C1", text: "replay attack" },
        environment: "prod"
      });
    assert.equal(replayTwice.status, 202);
    assert.equal(replayTwice.body.decision, "require_approval");
  } finally {
    restoreFetch();
  }
});
