import assert from "node:assert/strict";
import test from "node:test";
import { ensureDatabaseReady, request, resetDatabase } from "../test/testUtils";

test("policy update and soft-delete lifecycle", async (t) => {
  if (!(await ensureDatabaseReady())) {
    t.skip("Database not available for policy lifecycle test");
    return;
  }

  await resetDatabase();

  const createAgent = await request.post("/v1/agents").send({
    tenantId: "acme",
    name: "policy-agent",
    environment: "prod"
  });
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
  const policyId = createPolicy.body.id as string;

  const patchPolicy = await request.patch(`/v1/policies/${policyId}`).send({
    tenantId: "acme",
    connector: "github",
    actions: ["comment_pr"],
    effect: "require_approval"
  });
  assert.equal(patchPolicy.status, 200);
  assert.deepEqual(patchPolicy.body.actions, ["comment_pr"]);
  assert.equal(patchPolicy.body.effect, "require_approval");

  const deletePolicy = await request.delete(`/v1/policies/${policyId}`).send({ tenantId: "acme" });
  assert.equal(deletePolicy.status, 200);

  const listPolicies = await request.get("/v1/policies").query({ tenantId: "acme" });
  assert.equal(listPolicies.status, 200);
  assert.equal(listPolicies.body.count, 0);
});
