import { randomUUID } from "crypto";
import { Router } from "express";
import { addAuditEvent } from "../services/audit";
import { agents } from "../store";
import { Agent, Environment } from "../types";
import { nowIso } from "../utils/time";

export const agentsRouter = Router();

agentsRouter.post("/agents", (req, res) => {
  const body = req.body as { tenantId?: string; name?: string; environment?: Environment };

  if (!body.tenantId || !body.name) {
    res.status(400).json({ error: "tenantId and name are required" });
    return;
  }

  const agent: Agent = {
    id: randomUUID(),
    tenantId: body.tenantId,
    name: body.name,
    environment: body.environment ?? "dev",
    createdAt: nowIso()
  };
  agents.set(agent.id, agent);

  addAuditEvent({
    tenantId: agent.tenantId,
    agentId: agent.id,
    eventType: "agent.created",
    status: "success",
    details: { name: agent.name, environment: agent.environment }
  });

  res.status(201).json(agent);
});
