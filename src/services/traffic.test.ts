import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/agent_auth?schema=public";
process.env.TOKEN_SECRET = process.env.TOKEN_SECRET ?? "local-dev-secret-change-me-123";
process.env.TENANT_RATE_LIMIT_MAX_REQUESTS = "3";
process.env.AGENT_RATE_LIMIT_MAX_REQUESTS = "3";
process.env.CONNECTOR_RATE_LIMIT_MAX_REQUESTS = "3";
process.env.TENANT_DAILY_QUOTA = "2";
process.env.TENANT_QUOTA_OVERAGE_BEHAVIOR = "allow_with_audit";

const trafficService = require("./traffic") as typeof import("./traffic");

test("rate limit enforcement blocks excess requests", () => {
  trafficService.resetTrafficControlsForTests();

  trafficService.enforceTrafficControls({ tenantId: "acme", agentId: "agent-1", connector: "github" });
  trafficService.enforceTrafficControls({ tenantId: "acme", agentId: "agent-1", connector: "github" });
  trafficService.enforceTrafficControls({ tenantId: "acme", agentId: "agent-1", connector: "github" });

  assert.throws(() => {
    trafficService.enforceTrafficControls({ tenantId: "acme", agentId: "agent-1", connector: "github" });
  });
});

test("daily tenant quota returns quotaExceeded in allow-with-audit mode", () => {
  trafficService.resetTrafficControlsForTests();

  const first = trafficService.enforceTrafficControls({ tenantId: "tenant-quota", agentId: "a1", connector: "github" });
  const second = trafficService.enforceTrafficControls({ tenantId: "tenant-quota", agentId: "a2", connector: "slack" });
  const third = trafficService.enforceTrafficControls({ tenantId: "tenant-quota", agentId: "a3", connector: "jira" });

  assert.equal(first.quotaExceeded, false);
  assert.equal(second.quotaExceeded, false);
  assert.equal(third.quotaExceeded, true);
});
