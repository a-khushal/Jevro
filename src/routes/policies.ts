import { randomUUID } from "crypto";
import { Router } from "express";
import { addAuditEvent } from "../services/audit";
import { agents, policies } from "../store";
import { Effect, Environment, Policy } from "../types";

export const policiesRouter = Router();

policiesRouter.get("/policies", (req, res) => {
  const tenantId = typeof req.query.tenantId === "string" ? req.query.tenantId : undefined;
  const agentId = typeof req.query.agentId === "string" ? req.query.agentId : undefined;

  let result = policies;

  if (tenantId) {
    result = result.filter((policy) => policy.tenantId === tenantId);
  }

  if (agentId) {
    result = result.filter((policy) => policy.agentId === agentId);
  }

  res.status(200).json({ count: result.length, policies: result });
});

policiesRouter.post("/policies", (req, res) => {
  const body = req.body as {
    tenantId?: string;
    agentId?: string;
    connector?: string;
    actions?: string[];
    environment?: Environment;
    effect?: Effect;
  };

  if (
    !body.tenantId ||
    !body.agentId ||
    !body.connector ||
    !Array.isArray(body.actions) ||
    body.actions.length === 0 ||
    !body.environment ||
    !body.effect
  ) {
    res.status(400).json({ error: "tenantId, agentId, connector, actions, environment, effect are required" });
    return;
  }

  if (!agents.has(body.agentId)) {
    res.status(404).json({ error: "agent not found" });
    return;
  }

  const policy: Policy = {
    id: randomUUID(),
    tenantId: body.tenantId,
    agentId: body.agentId,
    connector: body.connector,
    actions: body.actions,
    environment: body.environment,
    effect: body.effect
  };
  policies.push(policy);

  addAuditEvent({
    tenantId: body.tenantId,
    agentId: body.agentId,
    eventType: "policy.created",
    connector: body.connector,
    status: "success",
    details: { actions: body.actions, effect: body.effect }
  });

  res.status(201).json(policy);
});
