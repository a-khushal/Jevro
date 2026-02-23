import { Request, Router } from "express";
import { AppError } from "../errors";
import { validate } from "../middleware/validate";
import { addAuditEvent } from "../services/audit";
import { consumeApproval, createApprovalRequest, getUsableApproval } from "../services/approvals";
import { authorizeDetailed } from "../services/authorize";
import { executeConnectorAction, isSupportedConnector, isWriteConnectorAction } from "../services/connectors";
import { getIdempotentResponse, saveIdempotentResponse } from "../services/idempotency";
import { recordSecuritySignal } from "../services/securityAlerts";
import { sendSlackApprovalRequest } from "../services/slack";
import { isManagedTokenRevoked, parseBearerToken, verifyManagedToken } from "../services/token";
import { enforceTrafficControls } from "../services/traffic";
import { Environment } from "../types";
import { proxyBodySchema, proxyParamsSchema } from "../validation/schemas";

export const proxyRouter = Router();

proxyRouter.post<{ connector: string; action: string }>(
  "/proxy/:connector/:action",
  validate({ params: proxyParamsSchema, body: proxyBodySchema }),
  async (req: Request<{ connector: string; action: string }>, res) => {
    const token = parseBearerToken(req);
    if (!token) {
      await recordSecuritySignal({ signal: "token_failure" });
      throw new AppError(401, "MISSING_BEARER_TOKEN", "Bearer token required");
    }

    const claims = await verifyManagedToken(token);
    if (!claims) {
      await recordSecuritySignal({ signal: "token_failure" });
      throw new AppError(401, "INVALID_TOKEN", "Invalid or expired token");
    }

    if (await isManagedTokenRevoked(claims.jti)) {
      await recordSecuritySignal({ signal: "token_failure", tenantId: claims.tenantId, details: { reason: "revoked" } });
      throw new AppError(401, "INVALID_TOKEN_REVOKED", "Token has been revoked");
    }

    if (!isSupportedConnector(req.params.connector)) {
      throw new AppError(400, "UNSUPPORTED_CONNECTOR", "Unsupported connector");
    }

    const trafficResult = enforceTrafficControls({
      tenantId: claims.tenantId,
      agentId: claims.sub,
      connector: req.params.connector
    });

    if (trafficResult.quotaExceeded) {
      await addAuditEvent({
        tenantId: claims.tenantId,
        agentId: claims.sub,
        eventType: "quota.exceeded",
        connector: req.params.connector,
        action: req.params.action,
        status: "failure",
        details: { behavior: "allow_with_audit" }
      });
    }

    const body = req.body as {
      payload?: Record<string, unknown>;
      environment?: Environment;
      approvalId?: string;
    };

    const idempotencyKey = req.header("idempotency-key")?.trim();
    const isWriteAction = isWriteConnectorAction(req.params.connector, req.params.action);

    if (idempotencyKey && isWriteAction) {
      const replay = await getIdempotentResponse({
        tenantId: claims.tenantId,
        agentId: claims.sub,
        connector: req.params.connector,
        action: req.params.action,
        idempotencyKey,
        requestBody: {
          payload: body.payload ?? {},
          environment: body.environment ?? claims.env,
          approvalId: body.approvalId ?? null
        }
      });

      if (replay) {
        res.setHeader("x-idempotent-replay", "true");
        res.status(replay.status).json({ ...replay.body, idempotentReplay: true });
        return;
      }
    }

    if (body.environment && body.environment !== claims.env) {
      await recordSecuritySignal({
        signal: "policy_bypass_attempt",
        tenantId: claims.tenantId,
        details: { reason: "token_env_mismatch", requestedEnv: body.environment, tokenEnv: claims.env }
      });
      throw new AppError(403, "TOKEN_ENV_MISMATCH", "Token environment does not match requested environment");
    }

    const environment = body.environment ?? claims.env;
    const auth = await authorizeDetailed({
      tenantId: claims.tenantId,
      agentId: claims.sub,
      connector: req.params.connector,
      action: req.params.action,
      environment
    });
    const decision = auth.decision;

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
      res.status(403).json({ decision, riskLevel: auth.riskLevel, error: "Request denied by policy" });
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

          let providerResponse: Record<string, unknown>;
          try {
            providerResponse = await executeConnectorAction({
              tenantId: claims.tenantId,
              connector: req.params.connector,
              action: req.params.action,
              payload: body.payload ?? {}
            });
          } catch (error: unknown) {
            await addAuditEvent({
              tenantId: claims.tenantId,
              agentId: claims.sub,
              eventType: "proxy.request",
              connector: req.params.connector,
              action: req.params.action,
              status: "failure",
              details: {
                decision: "allow_via_approval",
                error: error instanceof Error ? error.message : "Connector execution failed"
              }
            });

            throw error;
          }

          await addAuditEvent({
            tenantId: claims.tenantId,
            agentId: claims.sub,
            eventType: "proxy.request",
            connector: req.params.connector,
            action: req.params.action,
            status: "success",
            details: { decision: "allow_via_approval" }
          });

          const responseBody = {
            decision: "allow",
            baseDecision: auth.baseDecision,
            shadowDecision: auth.shadowDecision,
            riskLevel: auth.riskLevel,
            providerResponse
          };

          if (idempotencyKey && isWriteAction) {
            await saveIdempotentResponse(
              {
                tenantId: claims.tenantId,
                agentId: claims.sub,
                connector: req.params.connector,
                action: req.params.action,
                idempotencyKey,
                requestBody: {
                  payload: body.payload ?? {},
                  environment,
                  approvalId: body.approvalId ?? null
                }
              },
              {
                status: 200,
                body: responseBody
              }
            );
          }

          res.status(200).json(responseBody);
          return;
        }

        await recordSecuritySignal({
          signal: "policy_bypass_attempt",
          tenantId: claims.tenantId,
          details: { reason: "invalid_or_reused_approval", approvalId: body.approvalId }
        });
      }

      const approval = await createApprovalRequest({
        tenantId: claims.tenantId,
        agentId: claims.sub,
        connector: req.params.connector,
        action: req.params.action
      });

      const slackMessage = await sendSlackApprovalRequest({
        tenantId: claims.tenantId,
        agentId: claims.sub,
        connector: req.params.connector,
        action: req.params.action,
        approvalId: approval.id
      });

      await addAuditEvent({
        tenantId: claims.tenantId,
        agentId: claims.sub,
        eventType: "approval.required",
        connector: req.params.connector,
        action: req.params.action,
        status: "success",
        details: {
          decision,
          approvalId: approval.id,
          approvalChannel: "slack",
          approvalStatus: "pending",
          requiredApprovals: approval.requiredApprovals,
          riskLevel: approval.riskLevel
        }
      });

      await addAuditEvent({
        tenantId: claims.tenantId,
        agentId: claims.sub,
        eventType: "approval.notified",
        connector: req.params.connector,
        action: req.params.action,
        status: "success",
        details: {
          approvalId: approval.id,
          provider: "slack",
          channel: slackMessage.channel,
          messageTs: slackMessage.ts
        }
      });

      res.status(202).json({
        decision,
        message: "Approval required. Resolve approval then replay request with approvalId.",
        approval
      });
      return;
    }

    let providerResponse: Record<string, unknown>;
    try {
      providerResponse = await executeConnectorAction({
        tenantId: claims.tenantId,
        connector: req.params.connector,
        action: req.params.action,
        payload: body.payload ?? {}
      });
    } catch (error: unknown) {
      await addAuditEvent({
        tenantId: claims.tenantId,
        agentId: claims.sub,
        eventType: "proxy.request",
        connector: req.params.connector,
        action: req.params.action,
        status: "failure",
        details: {
          decision: "allow",
          error: error instanceof Error ? error.message : "Connector execution failed"
        }
      });

      throw error;
    }

    await addAuditEvent({
      tenantId: claims.tenantId,
      agentId: claims.sub,
      eventType: "proxy.request",
      connector: req.params.connector,
      action: req.params.action,
      status: "success",
      details: { decision: "allow" }
    });

    const responseBody = {
      decision,
      baseDecision: auth.baseDecision,
      shadowDecision: auth.shadowDecision,
      riskLevel: auth.riskLevel,
      providerResponse
    };

    if (idempotencyKey && isWriteAction) {
      await saveIdempotentResponse(
        {
          tenantId: claims.tenantId,
          agentId: claims.sub,
          connector: req.params.connector,
          action: req.params.action,
          idempotencyKey,
          requestBody: {
            payload: body.payload ?? {},
            environment,
            approvalId: body.approvalId ?? null
          }
        },
        {
          status: 200,
          body: responseBody
        }
      );
    }

    res.status(200).json(responseBody);
  }
);
