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

test("e2e idempotency key replays write action without duplicate execution", async (t) => {
  if (!(await ensureDatabaseReady())) {
    t.skip("Database not available for e2e test");
    return;
  }
  await resetDatabase();

  let postMessageCalls = 0;
  const restoreFetch = withMockedFetch(async (input) => {
    const url = String(input);
    if (url.includes("/chat.postMessage")) {
      postMessageCalls += 1;
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

    const first = await request
      .post("/v1/proxy/slack/post_message")
      .set("authorization", `Bearer ${token}`)
      .set("idempotency-key", "idem-1")
      .send({ payload: { channel: "C1", text: "hello" }, environment: "prod" });

    const second = await request
      .post("/v1/proxy/slack/post_message")
      .set("authorization", `Bearer ${token}`)
      .set("idempotency-key", "idem-1")
      .send({ payload: { channel: "C1", text: "hello" }, environment: "prod" });

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(second.body.idempotentReplay, true);
    assert.equal(postMessageCalls, 1);
  } finally {
    restoreFetch();
  }
});

test("high-risk actions require multiple approvals before replay", async (t) => {
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

    if (url.includes("/transitions")) {
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ ok: true });
  });

  try {
    const createAgent = await request.post("/v1/agents").send({ tenantId: "acme", name: "agent", environment: "prod" });
    const agentId = createAgent.body.id as string;

    await request.post("/v1/connectors/jira/credentials").send({ tenantId: "acme", token: "jira-tenant-token" });

    await request.post("/v1/policies").send({
      tenantId: "acme",
      agentId,
      connector: "jira",
      actions: ["transition_issue"],
      environment: "prod",
      effect: "allow"
    });

    const tokenRes = await request.post("/v1/tokens/mint").send({ tenantId: "acme", agentId });
    const token = tokenRes.body.token as string;

    const firstProxy = await request
      .post("/v1/proxy/jira/transition_issue")
      .set("authorization", `Bearer ${token}`)
      .send({ payload: { issue_key: "OPS-42", transition_id: "31" }, environment: "prod" });

    assert.equal(firstProxy.status, 202);
    assert.equal(firstProxy.body.approval.requiredApprovals, 2);
    const approvalId = firstProxy.body.approval.id as string;

    const firstDecision = await request.post(`/v1/approvals/${approvalId}/decision`).send({
      tenantId: "acme",
      approverId: "sec-lead-1",
      decision: "approved"
    });
    assert.equal(firstDecision.status, 200);
    assert.equal(firstDecision.body.approval.status, "pending");

    const secondDecision = await request.post(`/v1/approvals/${approvalId}/decision`).send({
      tenantId: "acme",
      approverId: "sec-lead-2",
      decision: "approved"
    });
    assert.equal(secondDecision.status, 200);
    assert.equal(secondDecision.body.approval.status, "approved");

    const replay = await request
      .post("/v1/proxy/jira/transition_issue")
      .set("authorization", `Bearer ${token}`)
      .send({
        approvalId,
        payload: { issue_key: "OPS-42", transition_id: "31" },
        environment: "prod"
      });

    assert.equal(replay.status, 200);
    assert.equal(replay.body.decision, "allow");
  } finally {
    restoreFetch();
  }
});
