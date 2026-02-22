import assert from "node:assert/strict";
import test from "node:test";
import { ensureDatabaseReady, request, resetDatabase } from "../test/testUtils";

test("v1 agent lifecycle: create agent, policy, mint token, authorize", async (t) => {
  if (!(await ensureDatabaseReady())) {
    t.skip("Database not available for integration test");
    return;
  }
  await resetDatabase();

  const createAgent = await request.post("/v1/agents").send({
    tenantId: "acme",
    name: "release-agent",
    environment: "prod"
  });
  assert.equal(createAgent.status, 201);
  const agentId = createAgent.body.id as string;

  const createPolicy = await request.post("/v1/policies").send({
    tenantId: "acme",
    agentId,
    connector: "github",
    actions: ["read_pr"],
    environment: "prod",
    effect: "allow"
  });
  assert.equal(createPolicy.status, 201);

  const mintToken = await request.post("/v1/tokens/mint").send({ tenantId: "acme", agentId });
  assert.equal(mintToken.status, 200);
  assert.ok(mintToken.body.token);

  const authorizeResponse = await request.post("/v1/authorize").send({
    tenantId: "acme",
    agentId,
    connector: "github",
    action: "read_pr",
    environment: "prod"
  });
  assert.equal(authorizeResponse.status, 200);
  assert.equal(authorizeResponse.body.decision, "allow");
});

test("list endpoints require tenantId for tenant isolation", async (t) => {
  if (!(await ensureDatabaseReady())) {
    t.skip("Database not available for integration test");
    return;
  }
  await resetDatabase();

  const listPolicies = await request.get("/v1/policies");
  const listAgents = await request.get("/v1/agents");
  const listApprovals = await request.get("/v1/approvals");
  const listAudit = await request.get("/v1/audit-events");
  const listConnectorHealth = await request.get("/v1/connectors/health");

  assert.equal(listPolicies.status, 400);
  assert.equal(listAgents.status, 400);
  assert.equal(listApprovals.status, 400);
  assert.equal(listAudit.status, 400);
  assert.equal(listConnectorHealth.status, 400);
});

test("authorize rejects environment mismatch", async (t) => {
  if (!(await ensureDatabaseReady())) {
    t.skip("Database not available for integration test");
    return;
  }
  await resetDatabase();

  const createAgent = await request.post("/v1/agents").send({
    tenantId: "acme",
    name: "release-agent",
    environment: "prod"
  });
  const agentId = createAgent.body.id as string;

  const response = await request.post("/v1/authorize").send({
    tenantId: "acme",
    agentId,
    connector: "github",
    action: "read_pr",
    environment: "dev"
  });

  assert.equal(response.status, 403);
  assert.equal(response.body.code, "AGENT_ENVIRONMENT_MISMATCH");
});
