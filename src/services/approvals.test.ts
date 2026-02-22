import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/agent_auth?schema=public";
process.env.TOKEN_SECRET = process.env.TOKEN_SECRET ?? "local-dev-secret-change-me-123";

const approvalsService = require("./approvals") as typeof import("./approvals");

const baseApproval = {
  tenantId: "acme",
  agentId: "agent-1",
  connector: "slack",
  action: "post_message",
  status: "approved",
  expiresAt: new Date(Date.now() + 60_000)
};

const baseRequest = {
  tenantId: "acme",
  agentId: "agent-1",
  connector: "slack",
  action: "post_message"
};

test("approval is usable when approved, unexpired, and context matches", () => {
  assert.equal(approvalsService.isApprovalUsable(baseApproval, baseRequest), true);
});

test("approval is not usable after it has been consumed", () => {
  assert.equal(
    approvalsService.isApprovalUsable(
      {
        ...baseApproval,
        status: "consumed"
      },
      baseRequest
    ),
    false
  );
});

test("approval is not usable when request context mismatches", () => {
  assert.equal(
    approvalsService.isApprovalUsable(baseApproval, {
      ...baseRequest,
      agentId: "agent-2"
    }),
    false
  );
});

test("approval is not usable once expired", () => {
  assert.equal(
    approvalsService.isApprovalUsable(
      {
        ...baseApproval,
        expiresAt: new Date(Date.now() - 10)
      },
      baseRequest
    ),
    false
  );
});
