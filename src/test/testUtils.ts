process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/agent_auth?schema=public";
process.env.TOKEN_SECRET = process.env.TOKEN_SECRET ?? "local-dev-secret-change-me-123";
process.env.SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN ?? "xoxb-test-token";
process.env.SLACK_APPROVAL_CHANNEL = process.env.SLACK_APPROVAL_CHANNEL ?? "C_TEST";
process.env.SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET ?? "slack-signing-secret";

const supertest = require("supertest") as typeof import("supertest");
const { app } = require("../app") as typeof import("../app");
const { prisma } = require("../lib/prisma") as typeof import("../lib/prisma");

export const request = supertest(app);

export async function resetDatabase(): Promise<void> {
  await prisma.auditEvent.deleteMany();
  await prisma.policy.deleteMany();
  await prisma.approvalRequest.deleteMany();
  await prisma.connectorCredential.deleteMany();
  await prisma.agent.deleteMany();
}

export async function ensureDatabaseReady(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    if (process.env.REQUIRE_DB_TESTS === "1") {
      throw new Error(
        `Database is required for this test run but is unavailable: ${error instanceof Error ? error.message : "unknown error"}`
      );
    }

    return false;
  }
}

export function withMockedFetch(handler: typeof fetch): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  return () => {
    globalThis.fetch = original;
  };
}
