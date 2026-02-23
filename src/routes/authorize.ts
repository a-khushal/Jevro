import { Router } from "express";
import { getAgentByTenantAndId } from "../db";
import { AppError } from "../errors";
import { validate } from "../middleware/validate";
import { addAuditEvent } from "../services/audit";
import { authorizeDetailed } from "../services/authorize";
import { AuthorizeInput } from "../types";
import { authorizeSchema } from "../validation/schemas";

export const authorizeRouter = Router();

authorizeRouter.post("/authorize", validate({ body: authorizeSchema }), async (req, res) => {
  const body = req.body as AuthorizeInput;

  const agent = await getAgentByTenantAndId({ tenantId: body.tenantId, agentId: body.agentId });
  if (!agent) {
    throw new AppError(404, "AGENT_NOT_FOUND", "Agent not found for tenant");
  }

  if (agent.environment !== body.environment) {
    throw new AppError(403, "AGENT_ENVIRONMENT_MISMATCH", "Agent cannot authorize against a different environment");
  }

  const detailed = await authorizeDetailed(body);
  await addAuditEvent({
    tenantId: body.tenantId,
    agentId: body.agentId,
    eventType: "policy.evaluated",
    connector: body.connector,
    action: body.action,
    status: detailed.decision === "deny" ? "failure" : "success",
    details: {
      decision: detailed.decision,
      baseDecision: detailed.baseDecision,
      shadowDecision: detailed.shadowDecision,
      riskLevel: detailed.riskLevel,
      environment: body.environment
    }
  });

  res.status(200).json({
    decision: detailed.decision,
    baseDecision: detailed.baseDecision,
    shadowDecision: detailed.shadowDecision,
    riskLevel: detailed.riskLevel
  });
});
