import { Router } from "express";
import { addAuditEvent } from "../services/audit";
import { resolveApproval } from "../services/approvals";
import { approvals } from "../store";

export const approvalsRouter = Router();

approvalsRouter.get("/approvals", (req, res) => {
  const tenantId = typeof req.query.tenantId === "string" ? req.query.tenantId : undefined;
  const agentId = typeof req.query.agentId === "string" ? req.query.agentId : undefined;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;

  let result = approvals;

  if (tenantId) {
    result = result.filter((approval) => approval.tenantId === tenantId);
  }

  if (agentId) {
    result = result.filter((approval) => approval.agentId === agentId);
  }

  if (status) {
    result = result.filter((approval) => approval.status === status);
  }

  res.status(200).json({ count: result.length, approvals: result });
});

approvalsRouter.post("/approvals/:approvalId/decision", (req, res) => {
  const body = req.body as { approverId?: string; decision?: "approved" | "rejected" };

  if (!body.approverId || !body.decision) {
    res.status(400).json({ error: "approverId and decision are required" });
    return;
  }

  if (body.decision !== "approved" && body.decision !== "rejected") {
    res.status(400).json({ error: "decision must be approved or rejected" });
    return;
  }

  const approval = resolveApproval({
    approvalId: req.params.approvalId,
    approverId: body.approverId,
    status: body.decision
  });

  if (!approval) {
    res.status(404).json({ error: "pending approval not found" });
    return;
  }

  addAuditEvent({
    tenantId: approval.tenantId,
    agentId: approval.agentId,
    eventType: "approval.resolved",
    connector: approval.connector,
    action: approval.action,
    status: body.decision === "approved" ? "success" : "failure",
    details: { approvalId: approval.id, approverId: body.approverId, decision: body.decision }
  });

  res.status(200).json({ approval });
});
