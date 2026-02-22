import { Router } from "express";
import { listAuditEvents } from "../db";
import { validate } from "../middleware/validate";
import { listAuditEventsQuerySchema } from "../validation/schemas";

export const auditRouter = Router();

auditRouter.get("/audit-events", validate({ query: listAuditEventsQuerySchema }), async (_req, res) => {
  const tenantId = _req.query.tenantId as string;
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
