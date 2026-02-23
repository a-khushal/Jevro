import { z } from "zod";

const environmentSchema = z.enum(["dev", "staging", "prod"]);
const effectSchema = z.enum(["allow", "deny", "require_approval"]);
const principalTypeSchema = z.enum(["agent", "service_account"]);
const approvalStatusSchema = z.enum(["pending", "approved", "rejected", "consumed", "expired"]);

export const createAgentSchema = z.object({
  tenantId: z.string().min(1),
  name: z.string().min(1),
  principalType: principalTypeSchema.optional(),
  environment: environmentSchema.optional()
});

export const agentParamsSchema = z.object({
  agentId: z.string().min(1)
});

export const deleteAgentSchema = z.object({
  tenantId: z.string().min(1)
});

export const listAgentsQuerySchema = z.object({
  tenantId: z.string().min(1)
});

export const createPolicySchema = z.object({
  tenantId: z.string().min(1),
  agentId: z.string().min(1),
  connector: z.string().min(1),
  actions: z.array(z.string().min(1)).min(1),
  environment: environmentSchema,
  effect: effectSchema,
  priority: z.number().int().min(1).max(1000).optional(),
  dryRun: z.boolean().optional(),
  templateId: z.string().min(1).optional()
});

export const policyParamsSchema = z.object({
  policyId: z.string().min(1)
});

export const updatePolicySchema = z
  .object({
    tenantId: z.string().min(1),
    connector: z.string().min(1).optional(),
    actions: z.array(z.string().min(1)).min(1).optional(),
    environment: environmentSchema.optional(),
    effect: effectSchema.optional(),
    priority: z.number().int().min(1).max(1000).optional(),
    dryRun: z.boolean().optional()
  })
  .refine(
    (value) =>
      value.connector !== undefined ||
      value.actions !== undefined ||
      value.environment !== undefined ||
      value.effect !== undefined ||
      value.priority !== undefined ||
      value.dryRun !== undefined,
    {
      message: "At least one field must be provided for update"
    }
  );

export const simulatePolicySchema = z.object({
  tenantId: z.string().min(1),
  agentId: z.string().min(1),
  connector: z.string().min(1),
  action: z.string().min(1),
  environment: environmentSchema,
  proposedPolicy: z
    .object({
      connector: z.string().min(1),
      actions: z.array(z.string().min(1)).min(1),
      effect: effectSchema,
      environment: environmentSchema,
      priority: z.number().int().min(1).max(1000).optional(),
      dryRun: z.boolean().optional()
    })
    .optional()
});

export const deletePolicySchema = z.object({
  tenantId: z.string().min(1)
});

export const listPoliciesQuerySchema = z.object({
  tenantId: z.string().min(1),
  agentId: z.string().min(1).optional()
});

export const mintTokenSchema = z.object({
  tenantId: z.string().min(1),
  agentId: z.string().min(1)
});

export const tenantConfigSchema = z.object({
  tenantId: z.string().min(1),
  tokenTtlSeconds: z.number().int().positive().optional()
});

export const tenantConfigQuerySchema = z.object({
  tenantId: z.string().min(1)
});

export const revokeTokenSchema = z.object({
  tenantId: z.string().min(1),
  token: z.string().min(20),
  reason: z.string().min(1).max(200).optional()
});

export const createSigningKeySchema = z.object({
  kid: z.string().min(1),
  secret: z.string().min(16),
  activate: z.boolean().optional()
});

export const activateSigningKeyParamsSchema = z.object({
  kid: z.string().min(1)
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
  tenantId: z.string().min(1),
  agentId: z.string().min(1).optional(),
  eventType: z.string().min(1).optional()
});

export const listApprovalsQuerySchema = z.object({
  tenantId: z.string().min(1),
  agentId: z.string().min(1).optional(),
  status: approvalStatusSchema.optional()
});

export const approvalDecisionParamsSchema = z.object({
  approvalId: z.string().min(1)
});

export const approvalDecisionBodySchema = z.object({
  tenantId: z.string().min(1),
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

export const upsertJiraCredentialSchema = z.object({
  tenantId: z.string().min(1),
  token: z.string().min(10)
});

export const connectorHealthQuerySchema = z.object({
  tenantId: z.string().min(1)
});
