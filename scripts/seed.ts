import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function ensureAgent(input: { tenantId: string; name: string; environment: "dev" | "staging" | "prod" }) {
  const existing = await prisma.agent.findFirst({
    where: {
      tenantId: input.tenantId,
      name: input.name,
      environment: input.environment,
      deletedAt: null
    }
  });

  if (existing) {
    return existing;
  }

  return prisma.agent.create({
    data: {
      tenantId: input.tenantId,
      name: input.name,
      principalType: "agent",
      environment: input.environment
    }
  });
}

async function ensurePolicy(input: {
  tenantId: string;
  agentId: string;
  connector: string;
  actions: string[];
  environment: "dev" | "staging" | "prod";
  effect: "allow" | "deny" | "require_approval";
}) {
  const existing = await prisma.policy.findFirst({
    where: {
      tenantId: input.tenantId,
      agentId: input.agentId,
      connector: input.connector,
      environment: input.environment,
      effect: input.effect,
      actions: {
        equals: input.actions
      },
      deletedAt: null
    }
  });

  if (existing) {
    return existing;
  }

  return prisma.policy.create({
    data: {
      ...input,
      priority: 100,
      dryRun: false
    }
  });
}

async function run(): Promise<void> {
  const tenantId = process.env.SEED_TENANT_ID ?? "acme";

  const agent = await ensureAgent({
    tenantId,
    name: "release-agent",
    environment: "prod"
  });

  await ensurePolicy({
    tenantId,
    agentId: agent.id,
    connector: "github",
    actions: ["read_pr", "comment_pr"],
    environment: "prod",
    effect: "allow"
  });

  await ensurePolicy({
    tenantId,
    agentId: agent.id,
    connector: "slack",
    actions: ["post_message"],
    environment: "prod",
    effect: "require_approval"
  });

  await prisma.auditEvent.create({
    data: {
      tenantId,
      agentId: agent.id,
      eventType: "seed.completed",
      status: "success",
      details: {
        seededAt: new Date().toISOString(),
        tenantId,
        agentId: agent.id
      }
    }
  });

  console.log(`Seed complete for tenant=${tenantId} agent=${agent.id}`);
}

run()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
