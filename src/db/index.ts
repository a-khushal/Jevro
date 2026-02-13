import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApprovalStatus, Effect, Environment } from "../types";

export async function createAgent(input: { tenantId: string; name: string; environment: Environment }) {
  return prisma.agent.create({
    data: {
      tenantId: input.tenantId,
      name: input.name,
      environment: input.environment
    }
  });
}

export async function getAgentById(agentId: string) {
  return prisma.agent.findUnique({ where: { id: agentId } });
}

export async function createPolicy(input: {
  tenantId: string;
  agentId: string;
  connector: string;
  actions: string[];
  environment: Environment;
  effect: Effect;
}) {
  return prisma.policy.create({
    data: {
      tenantId: input.tenantId,
      agentId: input.agentId,
      connector: input.connector,
      actions: input.actions,
      environment: input.environment,
      effect: input.effect
    }
  });
}

export async function listPolicies(filter: { tenantId?: string; agentId?: string }) {
  return prisma.policy.findMany({
    where: {
      tenantId: filter.tenantId,
      agentId: filter.agentId
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function listMatchingPolicies(input: {
  tenantId: string;
  agentId: string;
  connector: string;
  action: string;
  environment: Environment;
}) {
  return prisma.policy.findMany({
    where: {
      tenantId: input.tenantId,
      agentId: input.agentId,
      connector: input.connector,
      environment: input.environment,
      actions: {
        has: input.action
      }
    }
  });
}

export async function createAuditEvent(input: {
  tenantId: string;
  agentId?: string;
  eventType: string;
  connector?: string;
  action?: string;
  status: "success" | "failure";
  details: Record<string, unknown>;
}) {
  return prisma.auditEvent.create({
    data: {
      tenantId: input.tenantId,
      agentId: input.agentId,
      eventType: input.eventType,
      connector: input.connector,
      action: input.action,
      status: input.status,
      details: input.details as Prisma.InputJsonValue
    }
  });
}

export async function listAuditEvents(filter: { tenantId?: string; agentId?: string; eventType?: string }) {
  return prisma.auditEvent.findMany({
    where: {
      tenantId: filter.tenantId,
      agentId: filter.agentId,
      eventType: filter.eventType
    },
    orderBy: { timestamp: "desc" }
  });
}

export async function createApproval(input: {
  tenantId: string;
  agentId: string;
  connector: string;
  action: string;
  requestedAt: Date;
  expiresAt: Date;
}) {
  return prisma.approvalRequest.create({
    data: {
      tenantId: input.tenantId,
      agentId: input.agentId,
      connector: input.connector,
      action: input.action,
      status: "pending",
      requestedAt: input.requestedAt,
      expiresAt: input.expiresAt
    }
  });
}

export async function listApprovals(filter: { tenantId?: string; agentId?: string; status?: ApprovalStatus }) {
  return prisma.approvalRequest.findMany({
    where: {
      tenantId: filter.tenantId,
      agentId: filter.agentId,
      status: filter.status
    },
    orderBy: { requestedAt: "desc" }
  });
}

export async function resolveApproval(input: {
  approvalId: string;
  approverId: string;
  status: Extract<ApprovalStatus, "approved" | "rejected">;
}) {
  return prisma.approvalRequest.updateMany({
    where: {
      id: input.approvalId,
      status: "pending"
    },
    data: {
      status: input.status,
      resolvedBy: input.approverId,
      resolvedAt: new Date()
    }
  });
}

export async function getApprovalById(approvalId: string) {
  return prisma.approvalRequest.findUnique({ where: { id: approvalId } });
}

export async function consumeApproval(approvalId: string) {
  return prisma.approvalRequest.updateMany({
    where: {
      id: approvalId,
      status: "approved"
    },
    data: {
      status: "consumed"
    }
  });
}

export async function upsertConnectorCredential(input: {
  tenantId: string;
  connector: string;
  token: string;
}) {
  return prisma.connectorCredential.upsert({
    where: {
      tenantId_connector: {
        tenantId: input.tenantId,
        connector: input.connector
      }
    },
    create: {
      tenantId: input.tenantId,
      connector: input.connector,
      token: input.token
    },
    update: {
      token: input.token
    }
  });
}

export async function getConnectorCredential(input: { tenantId: string; connector: string }) {
  return prisma.connectorCredential.findUnique({
    where: {
      tenantId_connector: {
        tenantId: input.tenantId,
        connector: input.connector
      }
    }
  });
}
