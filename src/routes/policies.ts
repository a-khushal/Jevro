import { Router } from "express";
import {
  createPolicy,
  getAgentByTenantAndId,
  getPolicyByTenantAndId,
  listPolicies,
  softDeletePolicyByTenantAndId,
  updatePolicyByTenantAndId
} from "../db";
import { AppError } from "../errors";
import { validate } from "../middleware/validate";
import { addAuditEvent } from "../services/audit";
import { authorizeDetailed } from "../services/authorize";
import { isConnectorActionSupported, isSupportedConnector } from "../services/connectors";
import { getPolicyTemplateById, listPolicyTemplates } from "../services/policyTemplates";
import { Effect, Environment } from "../types";
import {
  createPolicySchema,
  deletePolicySchema,
  listPoliciesQuerySchema,
  policyParamsSchema,
  simulatePolicySchema,
  updatePolicySchema
} from "../validation/schemas";

export const policiesRouter = Router();

policiesRouter.get("/policies/templates", (_req, res) => {
  const templates = listPolicyTemplates();
  res.status(200).json({ count: templates.length, templates });
});

policiesRouter.get("/policies", validate({ query: listPoliciesQuerySchema }), async (req, res) => {
  const tenantId = req.query.tenantId as string;
  const agentId = typeof req.query.agentId === "string" ? req.query.agentId : undefined;

  const result = await listPolicies({ tenantId, agentId });
  res.status(200).json({
    count: result.length,
    policies: result.map((policy) => ({
      ...policy,
      createdAt: policy.createdAt.toISOString(),
      updatedAt: policy.updatedAt.toISOString(),
      deletedAt: policy.deletedAt ? policy.deletedAt.toISOString() : null
    }))
  });
});

policiesRouter.post("/policies", validate({ body: createPolicySchema }), async (req, res) => {
  const body = req.body as {
    tenantId: string;
    agentId: string;
    connector: string;
    actions: string[];
    environment: Environment;
    effect: Effect;
    priority?: number;
    dryRun?: boolean;
    templateId?: string;
  };

  const template = body.templateId ? getPolicyTemplateById(body.templateId) : null;
  if (body.templateId && !template) {
    throw new AppError(404, "POLICY_TEMPLATE_NOT_FOUND", "Policy template not found");
  }

  const connector = template?.connector ?? body.connector;
  const actions = template?.actions ?? body.actions;
  const environment = template?.environment ?? body.environment;
  const effect = template?.effect ?? body.effect;
  const priority = body.priority ?? template?.priority ?? 100;
  const dryRun = body.dryRun ?? template?.dryRun ?? false;

  if (!isSupportedConnector(connector)) {
    throw new AppError(400, "UNSUPPORTED_CONNECTOR", "Unsupported connector");
  }

  const unsupportedAction = actions.find((action) => !isConnectorActionSupported(connector, action));
  if (unsupportedAction) {
    throw new AppError(400, "UNSUPPORTED_CONNECTOR_ACTION", `Unsupported action for ${connector}: ${unsupportedAction}`);
  }

  const agent = await getAgentByTenantAndId({ tenantId: body.tenantId, agentId: body.agentId });
  if (!agent) {
    res.status(404).json({ error: "agent not found" });
    return;
  }

  if (agent.environment !== environment) {
    throw new AppError(400, "AGENT_ENVIRONMENT_MISMATCH", "Policy environment must match agent environment");
  }

  const policy = await createPolicy({
    tenantId: body.tenantId,
    agentId: body.agentId,
    connector,
    actions,
    environment,
    effect,
    priority,
    dryRun,
    templateId: body.templateId
  });

  await addAuditEvent({
    tenantId: body.tenantId,
    agentId: body.agentId,
    eventType: "policy.created",
    connector,
    status: "success",
    details: {
      actions,
      effect,
      priority,
      dryRun,
      templateId: body.templateId ?? null
    }
  });

  res.status(201).json({
    ...policy,
    createdAt: policy.createdAt.toISOString(),
    updatedAt: policy.updatedAt.toISOString()
  });
});

policiesRouter.patch(
  "/policies/:policyId",
  validate({ params: policyParamsSchema, body: updatePolicySchema }),
  async (req, res) => {
    const policyId = req.params.policyId as string;
    const body = req.body as {
      tenantId: string;
      connector?: string;
      actions?: string[];
      environment?: Environment;
      effect?: Effect;
      priority?: number;
      dryRun?: boolean;
    };

    const existing = await getPolicyByTenantAndId({ tenantId: body.tenantId, policyId });
    if (!existing) {
      throw new AppError(404, "POLICY_NOT_FOUND", "Policy not found for tenant");
    }

    const nextConnector = body.connector ?? existing.connector;
    const nextActions = body.actions ?? existing.actions;
    const nextEnvironment = body.environment ?? (existing.environment as Environment);
    const nextEffect = body.effect ?? (existing.effect as Effect);
    const nextPriority = body.priority ?? existing.priority;
    const nextDryRun = body.dryRun ?? existing.dryRun;

    if (!isSupportedConnector(nextConnector)) {
      throw new AppError(400, "UNSUPPORTED_CONNECTOR", "Unsupported connector");
    }

    const unsupportedAction = nextActions.find((action) => !isConnectorActionSupported(nextConnector, action));
    if (unsupportedAction) {
      throw new AppError(400, "UNSUPPORTED_CONNECTOR_ACTION", `Unsupported action for ${nextConnector}: ${unsupportedAction}`);
    }

    const agent = await getAgentByTenantAndId({ tenantId: body.tenantId, agentId: existing.agentId });
    if (!agent) {
      throw new AppError(404, "AGENT_NOT_FOUND", "Agent not found for tenant");
    }

    if (agent.environment !== nextEnvironment) {
      throw new AppError(400, "AGENT_ENVIRONMENT_MISMATCH", "Policy environment must match agent environment");
    }

    const updated = await updatePolicyByTenantAndId({
      tenantId: body.tenantId,
      policyId,
      connector: nextConnector,
      actions: nextActions,
      environment: nextEnvironment,
      effect: nextEffect,
      priority: nextPriority,
      dryRun: nextDryRun
    });

    if (!updated) {
      throw new AppError(404, "POLICY_NOT_FOUND", "Policy not found for tenant");
    }

    await addAuditEvent({
      tenantId: body.tenantId,
      agentId: updated.agentId,
      eventType: "policy.updated",
      connector: updated.connector,
      status: "success",
      details: {
        policyId: updated.id,
        actions: updated.actions,
        effect: updated.effect,
        environment: updated.environment,
        priority: updated.priority,
        dryRun: updated.dryRun
      }
    });

    res.status(200).json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString()
    });
  }
);

policiesRouter.post("/policies/simulate", validate({ body: simulatePolicySchema }), async (req, res) => {
  const body = req.body as {
    tenantId: string;
    agentId: string;
    connector: string;
    action: string;
    environment: Environment;
    proposedPolicy?: {
      connector: string;
      actions: string[];
      effect: Effect;
      environment: Environment;
      priority?: number;
      dryRun?: boolean;
    };
  };

  const current = await authorizeDetailed({
    tenantId: body.tenantId,
    agentId: body.agentId,
    connector: body.connector,
    action: body.action,
    environment: body.environment
  });

  let simulated = current;

  if (body.proposedPolicy) {
    if (!isSupportedConnector(body.proposedPolicy.connector)) {
      throw new AppError(400, "UNSUPPORTED_CONNECTOR", "Unsupported connector");
    }

    if (!body.proposedPolicy.actions.includes(body.action)) {
      throw new AppError(400, "SIMULATION_ACTION_MISMATCH", "proposed policy must include simulated action");
    }

    if (body.proposedPolicy.environment !== body.environment) {
      throw new AppError(400, "SIMULATION_ENVIRONMENT_MISMATCH", "proposed policy environment must match simulation environment");
    }

    const simulatedDecision = body.proposedPolicy.dryRun
      ? current.decision
      : body.proposedPolicy.effect;

    simulated = {
      ...current,
      decision: simulatedDecision,
      baseDecision: simulatedDecision,
      shadowDecision: body.proposedPolicy.dryRun ? body.proposedPolicy.effect : current.shadowDecision
    };
  }

  res.status(200).json({
    current,
    simulated
  });
});

policiesRouter.delete(
  "/policies/:policyId",
  validate({ params: policyParamsSchema, body: deletePolicySchema }),
  async (req, res) => {
    const policyId = req.params.policyId as string;
    const body = req.body as { tenantId: string };

    const existing = await getPolicyByTenantAndId({ tenantId: body.tenantId, policyId });
    if (!existing) {
      throw new AppError(404, "POLICY_NOT_FOUND", "Policy not found for tenant");
    }

    const removed = await softDeletePolicyByTenantAndId({ tenantId: body.tenantId, policyId });
    if (removed.count === 0) {
      throw new AppError(404, "POLICY_NOT_FOUND", "Policy not found for tenant");
    }

    await addAuditEvent({
      tenantId: body.tenantId,
      agentId: existing.agentId,
      eventType: "policy.deleted",
      connector: existing.connector,
      status: "success",
      details: { policyId, softDelete: true }
    });

    res.status(200).json({ deleted: true, policyId });
  }
);
