import { Router } from "express";
import { listApprovals } from "../db";
import { addAuditEvent } from "../services/audit";
import { resolveApproval } from "../services/approvals";
import { ApprovalStatus } from "../types";

export const approvalsRouter = Router();

approvalsRouter.get("/approvals", async (req, res) => {
  const tenantId = typeof req.query.tenantId === "string" ? req.query.tenantId : undefined;
  const agentId = typeof req.query.agentId === "string" ? req.query.agentId : undefined;
  const status = typeof req.query.status === "string" ? (req.query.status as ApprovalStatus) : undefined;

  const result = await listApprovals({ tenantId, agentId, status });

  res.status(200).json({
    count: result.length,
    approvals: result.map((approval) => ({
      ...approval,
      requestedAt: approval.requestedAt.toISOString(),
      expiresAt: approval.expiresAt.toISOString(),
      resolvedAt: approval.resolvedAt ? approval.resolvedAt.toISOString() : null
    }))
  });
});

approvalsRouter.post("/approvals/:approvalId/decision", async (req, res) => {
  const body = req.body as { approverId?: string; decision?: "approved" | "rejected" };

  if (!body.approverId || !body.decision) {
    res.status(400).json({ error: "approverId and decision are required" });
    return;
  }

  if (body.decision !== "approved" && body.decision !== "rejected") {
    res.status(400).json({ error: "decision must be approved or rejected" });
    return;
  }

  const approval = await resolveApproval({
    approvalId: req.params.approvalId,
    approverId: body.approverId,
    status: body.decision
  });

  if (!approval) {
    res.status(404).json({ error: "pending approval not found" });
    return;
  }

  await addAuditEvent({
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
