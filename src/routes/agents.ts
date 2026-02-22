import { Router } from "express";
import { createAgent, listAgentsByTenant, softDeleteAgentByTenantAndId } from "../db";
import { AppError } from "../errors";
import { validate } from "../middleware/validate";
import { addAuditEvent } from "../services/audit";
import { Environment } from "../types";
import { agentParamsSchema, createAgentSchema, deleteAgentSchema, listAgentsQuerySchema } from "../validation/schemas";

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

agentsRouter.delete(
  "/agents/:agentId",
  validate({ params: agentParamsSchema, body: deleteAgentSchema }),
  async (req, res) => {
    const body = req.body as { tenantId: string };
    const agentId = req.params.agentId as string;

    const removed = await softDeleteAgentByTenantAndId({ tenantId: body.tenantId, agentId });
    if (removed.count === 0) {
      throw new AppError(404, "AGENT_NOT_FOUND", "Agent not found for tenant");
    }

    await addAuditEvent({
      tenantId: body.tenantId,
      agentId,
      eventType: "agent.deleted",
      status: "success",
      details: { softDelete: true }
    });

    res.status(200).json({ deleted: true, agentId });
  }
);
