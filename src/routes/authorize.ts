import { Router } from "express";
import { addAuditEvent } from "../services/audit";
import { authorize } from "../services/authorize";
import { AuthorizeInput } from "../types";

export const authorizeRouter = Router();

authorizeRouter.post("/authorize", (req, res) => {
  const body = req.body as Partial<AuthorizeInput>;

  if (!body.tenantId || !body.agentId || !body.connector || !body.action || !body.environment) {
    res.status(400).json({ error: "tenantId, agentId, connector, action, environment are required" });
    return;
  }

  const decision = authorize(body as AuthorizeInput);
  addAuditEvent({
    tenantId: body.tenantId,
    agentId: body.agentId,
    eventType: "policy.evaluated",
    connector: body.connector,
    action: body.action,
    status: decision === "deny" ? "failure" : "success",
    details: { decision, environment: body.environment }
  });

  res.status(200).json({ decision });
});
