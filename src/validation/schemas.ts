import { z } from "zod";

const environmentSchema = z.enum(["dev", "staging", "prod"]);
const effectSchema = z.enum(["allow", "deny", "require_approval"]);
const approvalStatusSchema = z.enum(["pending", "approved", "rejected", "consumed", "expired"]);

export const createAgentSchema = z.object({
  tenantId: z.string().min(1),
  name: z.string().min(1),
  environment: environmentSchema.optional()
});

export const createPolicySchema = z.object({
  tenantId: z.string().min(1),
  agentId: z.string().min(1),
  connector: z.string().min(1),
  actions: z.array(z.string().min(1)).min(1),
  environment: environmentSchema,
  effect: effectSchema
});

export const listPoliciesQuerySchema = z.object({
  tenantId: z.string().min(1).optional(),
  agentId: z.string().min(1).optional()
});

export const mintTokenSchema = z.object({
  tenantId: z.string().min(1),
  agentId: z.string().min(1)
});

export const authorizeSchema = z.object({
  tenantId: z.string().min(1),
  agentId: z.string().min(1),
  connector: z.string().min(1),
  action: z.string().min(1),
  environment: environmentSchema
});

export const proxyParamsSchema = z.object({
  connector: z.string().min(1),
  action: z.string().min(1)
});

export const proxyBodySchema = z.object({
  payload: z.record(z.string(), z.unknown()).optional(),
  environment: environmentSchema.optional(),
  approvalId: z.string().min(1).optional()
});

export const listAuditEventsQuerySchema = z.object({
  tenantId: z.string().min(1).optional(),
  agentId: z.string().min(1).optional(),
  eventType: z.string().min(1).optional()
});

export const listApprovalsQuerySchema = z.object({
  tenantId: z.string().min(1).optional(),
  agentId: z.string().min(1).optional(),
  status: approvalStatusSchema.optional()
});

export const approvalDecisionParamsSchema = z.object({
  approvalId: z.string().min(1)
});

export const approvalDecisionBodySchema = z.object({
  approverId: z.string().min(1),
  decision: z.enum(["approved", "rejected"])
});

export const upsertGithubCredentialSchema = z.object({
  tenantId: z.string().min(1),
  token: z.string().min(10)
});

export const upsertSlackCredentialSchema = z.object({
  tenantId: z.string().min(1),
  token: z.string().min(10)
});
