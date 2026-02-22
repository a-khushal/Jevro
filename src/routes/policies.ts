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
import { isConnectorActionSupported, isSupportedConnector } from "../services/connectors";
import { Effect, Environment } from "../types";
import {
  createPolicySchema,
  deletePolicySchema,
  listPoliciesQuerySchema,
  policyParamsSchema,
  updatePolicySchema
} from "../validation/schemas";

export const policiesRouter = Router();

policiesRouter.get("/policies", validate({ query: listPoliciesQuerySchema }), async (req, res) => {
  const tenantId = req.query.tenantId as string;
  const agentId = typeof req.query.agentId === "string" ? req.query.agentId : undefined;

  const result = await listPolicies({ tenantId, agentId });
  res.status(200).json({
    count: result.length,
    policies: result.map((policy) => ({ ...policy, createdAt: policy.createdAt.toISOString() }))
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
  };

  if (!isSupportedConnector(body.connector)) {
    throw new AppError(400, "UNSUPPORTED_CONNECTOR", "Unsupported connector");
  }

  const unsupportedAction = body.actions.find((action) => !isConnectorActionSupported(body.connector, action));
  if (unsupportedAction) {
    throw new AppError(400, "UNSUPPORTED_CONNECTOR_ACTION", `Unsupported action for ${body.connector}: ${unsupportedAction}`);
  }

  const agent = await getAgentByTenantAndId({ tenantId: body.tenantId, agentId: body.agentId });
  if (!agent) {
    res.status(404).json({ error: "agent not found" });
    return;
  }

  if (agent.environment !== body.environment) {
    throw new AppError(400, "AGENT_ENVIRONMENT_MISMATCH", "Policy environment must match agent environment");
  }

  const policy = await createPolicy({
    tenantId: body.tenantId,
    agentId: body.agentId,
    connector: body.connector,
    actions: body.actions,
    environment: body.environment,
    effect: body.effect
  });

  await addAuditEvent({
    tenantId: body.tenantId,
    agentId: body.agentId,
    eventType: "policy.created",
    connector: body.connector,
    status: "success",
    details: { actions: body.actions, effect: body.effect }
  });

  res.status(201).json({ ...policy, createdAt: policy.createdAt.toISOString() });
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
    };

    const existing = await getPolicyByTenantAndId({ tenantId: body.tenantId, policyId });
    if (!existing) {
      throw new AppError(404, "POLICY_NOT_FOUND", "Policy not found for tenant");
    }

    const nextConnector = body.connector ?? existing.connector;
    const nextActions = body.actions ?? existing.actions;
    const nextEnvironment = body.environment ?? (existing.environment as Environment);
    const nextEffect = body.effect ?? (existing.effect as Effect);

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
      effect: nextEffect
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
        environment: updated.environment
      }
    });

    res.status(200).json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString()
    });
  }
);

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
