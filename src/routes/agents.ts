import { Router } from "express";
import { createAgent } from "../db";
import { addAuditEvent } from "../services/audit";
import { Environment } from "../types";

export const agentsRouter = Router();

agentsRouter.post("/agents", async (req, res) => {
  const body = req.body as { tenantId?: string; name?: string; environment?: Environment };

  if (!body.tenantId || !body.name) {
    res.status(400).json({ error: "tenantId and name are required" });
    return;
  }

  const agent = await createAgent({
    tenantId: body.tenantId,
    name: body.name,
    environment: body.environment ?? "dev"
  });

  await addAuditEvent({
    tenantId: agent.tenantId,
    agentId: agent.id,
    eventType: "agent.created",
    status: "success",
    details: { name: agent.name, environment: agent.environment }
  });

  res.status(201).json({ ...agent, createdAt: agent.createdAt.toISOString() });
});
