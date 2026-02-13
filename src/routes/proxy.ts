import { Request, Router } from "express";
import { addAuditEvent } from "../services/audit";
import { consumeApproval, createApprovalRequest, getUsableApproval } from "../services/approvals";
import { authorize } from "../services/authorize";
import { executeConnectorAction, isSupportedConnector } from "../services/connectors";
import { parseBearerToken, verifyToken } from "../services/token";
import { Environment } from "../types";

export const proxyRouter = Router();

proxyRouter.post<{ connector: string; action: string }>(
  "/proxy/:connector/:action",
  async (req: Request<{ connector: string; action: string }>, res) => {
    const token = parseBearerToken(req);
    if (!token) {
      res.status(401).json({ error: "Bearer token required" });
      return;
    }

    const claims = verifyToken(token);
    if (!claims) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    if (!isSupportedConnector(req.params.connector)) {
      res.status(400).json({ error: "Unsupported connector" });
      return;
    }

    const body = req.body as {
      payload?: Record<string, unknown>;
      environment?: Environment;
      approvalId?: string;
    };
    const environment = body.environment ?? claims.env;
    const decision = await authorize({
      tenantId: claims.tenantId,
      agentId: claims.sub,
      connector: req.params.connector,
      action: req.params.action,
      environment
    });

    if (decision === "deny") {
      await addAuditEvent({
        tenantId: claims.tenantId,
        agentId: claims.sub,
        eventType: "proxy.request",
        connector: req.params.connector,
        action: req.params.action,
        status: "failure",
        details: { decision }
      });
      res.status(403).json({ decision, error: "Request denied by policy" });
      return;
    }

    if (decision === "require_approval") {
      if (body.approvalId) {
        const approved = await getUsableApproval({
          approvalId: body.approvalId,
          tenantId: claims.tenantId,
          agentId: claims.sub,
          connector: req.params.connector,
          action: req.params.action
        });

        if (approved) {
          await consumeApproval(approved.id);

          await addAuditEvent({
            tenantId: claims.tenantId,
            agentId: claims.sub,
            eventType: "approval.consumed",
            connector: req.params.connector,
            action: req.params.action,
            status: "success",
            details: { approvalId: approved.id }
          });

          const providerResponse = executeConnectorAction({
            connector: req.params.connector,
            action: req.params.action,
            payload: body.payload ?? {}
          });

          await addAuditEvent({
            tenantId: claims.tenantId,
            agentId: claims.sub,
            eventType: "proxy.request",
            connector: req.params.connector,
            action: req.params.action,
            status: "success",
            details: { decision: "allow_via_approval" }
          });

          res.status(200).json({ decision: "allow", providerResponse });
          return;
        }
      }

      const approval = await createApprovalRequest({
        tenantId: claims.tenantId,
        agentId: claims.sub,
        connector: req.params.connector,
        action: req.params.action
      });

      await addAuditEvent({
        tenantId: claims.tenantId,
        agentId: claims.sub,
        eventType: "approval.required",
        connector: req.params.connector,
        action: req.params.action,
        status: "success",
        details: { decision, approvalId: approval.id, approvalChannel: "slack", approvalStatus: "pending" }
      });
      res.status(202).json({
        decision,
        message: "Approval required. Resolve approval then replay request with approvalId.",
        approval
      });
      return;
    }

    const providerResponse = executeConnectorAction({
      connector: req.params.connector,
      action: req.params.action,
      payload: body.payload ?? {}
    });

    await addAuditEvent({
      tenantId: claims.tenantId,
      agentId: claims.sub,
      eventType: "proxy.request",
      connector: req.params.connector,
      action: req.params.action,
      status: "success",
      details: { decision: "allow" }
    });

    res.status(200).json({ decision, providerResponse });
  }
);
