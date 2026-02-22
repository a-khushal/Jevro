import { Router } from "express";
import { createAgent, listAgentsByTenant } from "../db";
import { validate } from "../middleware/validate";
import { addAuditEvent } from "../services/audit";
import { Environment } from "../types";
import { createAgentSchema, listAgentsQuerySchema } from "../validation/schemas";

export const agentsRouter = Router();

agentsRouter.get("/agents", validate({ query: listAgentsQuerySchema }), async (req, res) => {
  const tenantId = req.query.tenantId as string;
  const result = await listAgentsByTenant(tenantId);

  res.status(200).json({
    count: result.length,
    agents: result.map((agent) => ({ ...agent, createdAt: agent.createdAt.toISOString() }))
  });
});

agentsRouter.post("/agents", validate({ body: createAgentSchema }), async (req, res) => {
  const body = req.body as { tenantId: string; name: string; environment?: Environment };

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
