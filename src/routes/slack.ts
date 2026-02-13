import express, { Router } from "express";
import { AppError } from "../errors";
import { addAuditEvent } from "../services/audit";
import { resolveApproval } from "../services/approvals";
import { parseSlackInteractivityPayload, verifySlackSignature } from "../services/slack";

export const slackRouter = Router();

slackRouter.post(
  "/integrations/slack/interactivity",
  express.raw({ type: "application/x-www-form-urlencoded" }),
  async (req, res) => {
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";

    verifySlackSignature({
      rawBody,
      timestampHeader: req.header("x-slack-request-timestamp"),
      signatureHeader: req.header("x-slack-signature")
    });

    const payload = parseSlackInteractivityPayload(rawBody);
    const action = payload.actions[0];

    let decision: "approved" | "rejected";
    if (action.action_id === "approve") {
      decision = "approved";
    } else if (action.action_id === "reject") {
      decision = "rejected";
    } else {
      throw new AppError(400, "SLACK_ACTION_INVALID", "Unsupported Slack action_id");
    }

    const approval = await resolveApproval({
      approvalId: action.value,
      approverId: payload.user.id,
      status: decision
    });

    if (!approval) {
      res.status(200).json({
        replace_original: false,
        response_type: "ephemeral",
        text: "Approval was not found or was already resolved."
      });
      return;
    }

    await addAuditEvent({
      tenantId: approval.tenantId,
      agentId: approval.agentId,
      eventType: "approval.resolved.via_slack",
      connector: approval.connector,
      action: approval.action,
      status: decision === "approved" ? "success" : "failure",
      details: {
        approvalId: approval.id,
        approverId: payload.user.id,
        decision
      }
    });

    res.status(200).json({
      replace_original: true,
      text: `Approval ${decision} by ${payload.user.id}`
    });
  }
);
