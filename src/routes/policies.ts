import { Router } from "express";
import { createPolicy, getAgentByTenantAndId, listPolicies } from "../db";
import { AppError } from "../errors";
import { validate } from "../middleware/validate";
import { addAuditEvent } from "../services/audit";
import { isConnectorActionSupported, isSupportedConnector } from "../services/connectors";
import { Effect, Environment } from "../types";
import { createPolicySchema, listPoliciesQuerySchema } from "../validation/schemas";

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
