import { Router } from "express";
import { listAuditEvents } from "../db";

export const auditRouter = Router();

auditRouter.get("/audit-events", async (_req, res) => {
  const tenantId = typeof _req.query.tenantId === "string" ? _req.query.tenantId : undefined;
  const agentId = typeof _req.query.agentId === "string" ? _req.query.agentId : undefined;
  const eventType = typeof _req.query.eventType === "string" ? _req.query.eventType : undefined;

  const result = await listAuditEvents({ tenantId, agentId, eventType });
  res.status(200).json({
    count: result.length,
    events: result.map((event) => ({
      ...event,
      timestamp: event.timestamp.toISOString(),
      details: event.details as Record<string, unknown>
    }))
  });
});
