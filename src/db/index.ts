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
  return prisma.agent.findFirst({ where: { id: agentId, deletedAt: null } });
}

export async function getAgentByTenantAndId(input: { tenantId: string; agentId: string }) {
  return prisma.agent.findFirst({
    where: {
      id: input.agentId,
      tenantId: input.tenantId,
      deletedAt: null
    }
  });
}

export async function listAgentsByTenant(tenantId: string) {
  return prisma.agent.findMany({
    where: {
      tenantId,
      deletedAt: null
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}

export async function softDeleteAgentByTenantAndId(input: { tenantId: string; agentId: string }) {
  return prisma.agent.updateMany({
    where: {
      tenantId: input.tenantId,
      id: input.agentId,
      deletedAt: null
    },
    data: {
      deletedAt: new Date()
    }
  });
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
      agentId: filter.agentId,
      deletedAt: null
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function getPolicyByTenantAndId(input: { tenantId: string; policyId: string }) {
  return prisma.policy.findFirst({
    where: {
      id: input.policyId,
      tenantId: input.tenantId,
      deletedAt: null
    }
  });
}

export async function updatePolicyByTenantAndId(input: {
  tenantId: string;
  policyId: string;
  connector: string;
  actions: string[];
  environment: Environment;
  effect: Effect;
}) {
  const updated = await prisma.policy.updateMany({
    where: {
      id: input.policyId,
      tenantId: input.tenantId,
      deletedAt: null
    },
    data: {
      connector: input.connector,
      actions: input.actions,
      environment: input.environment,
      effect: input.effect
    }
  });

  if (updated.count === 0) {
    return null;
  }

  return getPolicyByTenantAndId({ tenantId: input.tenantId, policyId: input.policyId });
}

export async function softDeletePolicyByTenantAndId(input: { tenantId: string; policyId: string }) {
  return prisma.policy.updateMany({
    where: {
      id: input.policyId,
      tenantId: input.tenantId,
      deletedAt: null
    },
    data: {
      deletedAt: new Date()
    }
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
      deletedAt: null,
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
  tenantId?: string;
  approverId: string;
  status: Extract<ApprovalStatus, "approved" | "rejected">;
}) {
  return prisma.approvalRequest.updateMany({
    where: {
      id: input.approvalId,
      tenantId: input.tenantId,
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
      status: "consumed",
      resolvedAt: new Date(),
      resolvedBy: "system:consumed"
    }
  });
}

export async function listExpiredPendingApprovals(input: { now: Date; limit?: number }) {
  return prisma.approvalRequest.findMany({
    where: {
      status: "pending",
      expiresAt: {
        lte: input.now
      }
    },
    orderBy: {
      expiresAt: "asc"
    },
    take: input.limit ?? 100
  });
}

export async function expireApproval(approvalId: string, now: Date) {
  return prisma.approvalRequest.updateMany({
    where: {
      id: approvalId,
      status: "pending"
    },
    data: {
      status: "expired",
      resolvedAt: now,
      resolvedBy: "system:auto-expire"
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

export async function listConnectorCredentialsByTenant(tenantId: string) {
  return prisma.connectorCredential.findMany({
    where: {
      tenantId
    }
  });
}

export async function ensureDefaultActiveSigningKey(input: { kid: string; secret: string }) {
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    await tx.signingKey.updateMany({
      where: {
        isActive: true,
        kid: {
          not: input.kid
        }
      },
      data: {
        isActive: false,
        deactivatedAt: now
      }
    });

    await tx.signingKey.upsert({
      where: {
        kid: input.kid
      },
      create: {
        kid: input.kid,
        secret: input.secret,
        isActive: true,
        activatedAt: now,
        deactivatedAt: null
      },
      update: {
        secret: input.secret,
        isActive: true,
        activatedAt: now,
        deactivatedAt: null
      }
    });

    return tx.signingKey.findUnique({ where: { kid: input.kid } });
  });
}

export async function getActiveSigningKey() {
  return prisma.signingKey.findFirst({
    where: {
      isActive: true
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}

export async function getSigningKeyByKid(kid: string) {
  return prisma.signingKey.findUnique({
    where: {
      kid
    }
  });
}

export async function createSigningKey(input: { kid: string; secret: string; activate?: boolean }) {
  const created = await prisma.signingKey.create({
    data: {
      kid: input.kid,
      secret: input.secret,
      isActive: Boolean(input.activate),
      activatedAt: input.activate ? new Date() : null,
      deactivatedAt: null
    }
  });

  if (input.activate) {
    await prisma.signingKey.updateMany({
      where: {
        isActive: true,
        kid: {
          not: input.kid
        }
      },
      data: {
        isActive: false,
        deactivatedAt: new Date()
      }
    });
  }

  return created;
}

export async function activateSigningKey(kid: string) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    await tx.signingKey.updateMany({
      where: {
        isActive: true,
        kid: {
          not: kid
        }
      },
      data: {
        isActive: false,
        deactivatedAt: now
      }
    });

    const updated = await tx.signingKey.updateMany({
      where: {
        kid
      },
      data: {
        isActive: true,
        activatedAt: now,
        deactivatedAt: null
      }
    });

    if (updated.count === 0) {
      return null;
    }

    return tx.signingKey.findUnique({ where: { kid } });
  });
}

export async function listSigningKeysMetadata() {
  return prisma.signingKey.findMany({
    select: {
      kid: true,
      isActive: true,
      createdAt: true,
      activatedAt: true,
      deactivatedAt: true
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}

export async function revokeToken(input: {
  jti: string;
  tenantId: string;
  agentId: string;
  expiresAt: Date;
  reason?: string;
}) {
  return prisma.revokedToken.upsert({
    where: {
      jti: input.jti
    },
    create: {
      jti: input.jti,
      tenantId: input.tenantId,
      agentId: input.agentId,
      expiresAt: input.expiresAt,
      reason: input.reason
    },
    update: {
      reason: input.reason ?? undefined
    }
  });
}

export async function getRevokedTokenByJti(jti: string) {
  return prisma.revokedToken.findUnique({
    where: {
      jti
    }
  });
}

export async function purgeExpiredRevokedTokens(now: Date) {
  return prisma.revokedToken.deleteMany({
    where: {
      expiresAt: {
        lt: now
      }
    }
  });
}

export async function purgeAuditEventsBefore(cutoff: Date) {
  return prisma.auditEvent.deleteMany({
    where: {
      timestamp: {
        lt: cutoff
      }
    }
  });
}

export async function purgeResolvedApprovalsBefore(cutoff: Date) {
  return prisma.approvalRequest.deleteMany({
    where: {
      status: {
        in: ["approved", "rejected", "consumed", "expired"]
      },
      OR: [
        {
          resolvedAt: {
            lt: cutoff
          }
        },
        {
          resolvedAt: null,
          requestedAt: {
            lt: cutoff
          }
        }
      ]
    }
  });
}
