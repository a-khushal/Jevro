import { Router } from "express";
import { TOKEN_TTL_SECONDS } from "../config";
import { getAgentByTenantAndId } from "../db";
import { AppError } from "../errors";
import { validate } from "../middleware/validate";
import { addAuditEvent } from "../services/audit";
import { createToken } from "../services/token";
import { Environment, TokenClaims } from "../types";
import { mintTokenSchema } from "../validation/schemas";

function isEnvironment(value: string): value is Environment {
  return value === "dev" || value === "staging" || value === "prod";
}

export const tokensRouter = Router();

tokensRouter.post("/tokens/mint", validate({ body: mintTokenSchema }), async (req, res) => {
  const body = req.body as { tenantId: string; agentId: string };
  const agent = await getAgentByTenantAndId({ tenantId: body.tenantId, agentId: body.agentId });

  if (!agent) {
    throw new AppError(400, "INVALID_AGENT", "valid tenantId and agentId are required");
  }

  if (!isEnvironment(agent.environment)) {
    throw new AppError(500, "INVALID_AGENT_ENV", "Agent has invalid environment");
  }

  const iat = Math.floor(Date.now() / 1000);
  const claims: TokenClaims = {
    sub: agent.id,
    tenantId: agent.tenantId,
    env: agent.environment,
    iat,
    exp: iat + TOKEN_TTL_SECONDS
  };
  const token = createToken(claims);

  await addAuditEvent({
    tenantId: agent.tenantId,
    agentId: agent.id,
    eventType: "token.minted",
    status: "success",
    details: { expiresInSeconds: TOKEN_TTL_SECONDS }
  });

  res.status(200).json({ token, expiresInSeconds: TOKEN_TTL_SECONDS });
});
