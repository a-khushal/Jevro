import { Request, Router } from "express";
import { listApprovals } from "../db";
import { AppError } from "../errors";
import { validate } from "../middleware/validate";
import { addAuditEvent } from "../services/audit";
import { resolveApproval } from "../services/approvals";
import { ApprovalStatus } from "../types";
import { approvalDecisionBodySchema, approvalDecisionParamsSchema, listApprovalsQuerySchema } from "../validation/schemas";

export const approvalsRouter = Router();

approvalsRouter.get("/approvals", validate({ query: listApprovalsQuerySchema }), async (req, res) => {
  const tenantId = req.query.tenantId as string;
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

approvalsRouter.post(
  "/approvals/:approvalId/decision",
  validate({ params: approvalDecisionParamsSchema, body: approvalDecisionBodySchema }),
  async (req: Request<{ approvalId: string }>, res) => {
    const body = req.body as { tenantId: string; approverId: string; decision: "approved" | "rejected" };

    const approval = await resolveApproval({
      approvalId: req.params.approvalId,
      tenantId: body.tenantId,
      approverId: body.approverId,
      status: body.decision
    });

    if (!approval) {
      throw new AppError(404, "APPROVAL_NOT_FOUND", "pending approval not found");
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
  }
);
