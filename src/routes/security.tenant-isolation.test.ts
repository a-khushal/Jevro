import assert from "node:assert/strict";
import test from "node:test";
import { ensureDatabaseReady, request, resetDatabase, withMockedFetch } from "../test/testUtils";

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

test("cannot mint token for another tenant's agent", async (t) => {
  if (!(await ensureDatabaseReady())) {
    t.skip("Database not available for security test");
    return;
  }
  await resetDatabase();

  const createAgent = await request.post("/v1/agents").send({
    tenantId: "tenant-a",
    name: "agent-a",
    environment: "prod"
  });

  const response = await request.post("/v1/tokens/mint").send({
    tenantId: "tenant-b",
    agentId: createAgent.body.id
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.code, "INVALID_AGENT");
});

test("cannot resolve approval from another tenant", async (t) => {
  if (!(await ensureDatabaseReady())) {
    t.skip("Database not available for security test");
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
    const createAgent = await request.post("/v1/agents").send({
      tenantId: "tenant-a",
      name: "agent-a",
      environment: "prod"
    });
    const agentId = createAgent.body.id as string;

    await request.post("/v1/connectors/slack/credentials").send({ tenantId: "tenant-a", token: "xoxb-token" });

    await request.post("/v1/policies").send({
      tenantId: "tenant-a",
      agentId,
      connector: "slack",
      actions: ["post_message"],
      environment: "prod",
      effect: "require_approval"
    });

    const tokenRes = await request.post("/v1/tokens/mint").send({ tenantId: "tenant-a", agentId });
    const token = tokenRes.body.token as string;

    const firstProxy = await request
      .post("/v1/proxy/slack/post_message")
      .set("authorization", `Bearer ${token}`)
      .send({ payload: { channel: "C1", text: "needs approval" }, environment: "prod" });

    const approvalId = firstProxy.body.approval.id as string;

    const crossTenantDecision = await request.post(`/v1/approvals/${approvalId}/decision`).send({
      tenantId: "tenant-b",
      approverId: "sec-lead-1",
      decision: "approved"
    });

    assert.equal(crossTenantDecision.status, 404);
    assert.equal(crossTenantDecision.body.code, "APPROVAL_NOT_FOUND");
  } finally {
    restoreFetch();
  }
});
