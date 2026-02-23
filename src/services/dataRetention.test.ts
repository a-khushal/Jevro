import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../lib/prisma";
import { ensureDatabaseReady, resetDatabase } from "../test/testUtils";

process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/agent_auth?schema=public";
process.env.TOKEN_SECRET = process.env.TOKEN_SECRET ?? "local-dev-secret-change-me-123";

const retentionService = require("./dataRetention") as typeof import("./dataRetention");

test("data retention purges old audit, approvals, and revoked tokens", async (t) => {
  if (!(await ensureDatabaseReady())) {
    t.skip("Database not available for retention test");
    return;
  }

  await resetDatabase();

  const agent = await prisma.agent.create({
    data: {
      tenantId: "acme",
      name: "retention-agent",
      environment: "prod"
    }
  });

  const old = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);

  await prisma.auditEvent.create({
    data: {
      tenantId: "acme",
      agentId: agent.id,
      eventType: "old.audit",
      status: "success",
      timestamp: old,
      details: { old: true }
    }
  });

  await prisma.approvalRequest.create({
    data: {
      tenantId: "acme",
      agentId: agent.id,
      connector: "slack",
      action: "post_message",
      status: "rejected",
      requestedAt: old,
      expiresAt: old,
      resolvedAt: old,
      resolvedBy: "sec-lead"
    }
  });

  await prisma.revokedToken.create({
    data: {
      jti: "old-revoked-jti",
      tenantId: "acme",
      agentId: agent.id,
      expiresAt: old
    }
  });

  const result = await retentionService.runDataRetention({
    auditRetentionDays: 30,
    approvalRetentionDays: 30
  });

  assert.equal(result.deletedAuditEvents, 1);
  assert.equal(result.deletedApprovals, 1);
  assert.equal(result.deletedRevokedTokens, 1);
  assert.equal(result.deletedIdempotencyRecords, 0);
});
