import assert from "node:assert/strict";
import test from "node:test";
import { ensureDatabaseReady, request, resetDatabase, withMockedFetch } from "../test/testUtils";

function textResponse(status: number, text: string): Response {
  return new Response(text, {
    status,
    headers: {
      "content-type": "text/plain"
    }
  });
}

test("connector health returns telemetry and scope introspection", async (t) => {
  if (!(await ensureDatabaseReady())) {
    t.skip("Database not available for connector health test");
    return;
  }

  await resetDatabase();

  const restoreFetch = withMockedFetch(async () => textResponse(500, "upstream unavailable"));

  try {
    const createAgent = await request.post("/v1/agents").send({
      tenantId: "acme",
      name: "connector-health-agent",
      environment: "prod"
    });
    const agentId = createAgent.body.id as string;

    await request.post("/v1/connectors/github/credentials").send({
      tenantId: "acme",
      token: "ghp_token_value"
    });

    await request.post("/v1/policies").send({
      tenantId: "acme",
      agentId,
      connector: "github",
      actions: ["read_pr"],
      environment: "prod",
      effect: "allow"
    });

    const mint = await request.post("/v1/tokens/mint").send({ tenantId: "acme", agentId });
    const token = mint.body.token as string;

    const proxy = await request
      .post("/v1/proxy/github/read_pr")
      .set("authorization", `Bearer ${token}`)
      .send({ environment: "prod", payload: { owner: "acme", repo: "api", pull_number: 1 } });
    assert.equal(proxy.status, 502);

    const health = await request.get("/v1/connectors/health").query({ tenantId: "acme" });
    assert.equal(health.status, 200);

    const github = (health.body.connectors as Array<Record<string, unknown>>).find((item) => item.connector === "github");
    assert.ok(github);
    assert.ok(github?.telemetry);
    assert.ok(github?.requiredScopesByAction);
  } finally {
    restoreFetch();
  }
});
