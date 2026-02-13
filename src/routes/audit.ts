import { Router } from "express";
import { auditEvents } from "../store";

export const auditRouter = Router();

auditRouter.get("/audit-events", (_req, res) => {
  const tenantId = typeof _req.query.tenantId === "string" ? _req.query.tenantId : undefined;
  const agentId = typeof _req.query.agentId === "string" ? _req.query.agentId : undefined;
  const eventType = typeof _req.query.eventType === "string" ? _req.query.eventType : undefined;

  let result = auditEvents;

  if (tenantId) {
    result = result.filter((event) => event.tenantId === tenantId);
  }

  if (agentId) {
    result = result.filter((event) => event.agentId === agentId);
  }

  if (eventType) {
    result = result.filter((event) => event.eventType === eventType);
  }

  res.status(200).json({ count: result.length, events: result });
});
