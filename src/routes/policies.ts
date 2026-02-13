import { Router } from "express";
import { createPolicy, getAgentById, listPolicies } from "../db";
import { validate } from "../middleware/validate";
import { addAuditEvent } from "../services/audit";
import { Effect, Environment } from "../types";
import { createPolicySchema, listPoliciesQuerySchema } from "../validation/schemas";

export const policiesRouter = Router();

policiesRouter.get("/policies", validate({ query: listPoliciesQuerySchema }), async (req, res) => {
  const tenantId = typeof req.query.tenantId === "string" ? req.query.tenantId : undefined;
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

  const agent = await getAgentById(body.agentId);
  if (!agent || agent.tenantId !== body.tenantId) {
    res.status(404).json({ error: "agent not found" });
    return;
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
