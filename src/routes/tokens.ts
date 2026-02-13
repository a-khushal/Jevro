import { Router } from "express";
import { TOKEN_TTL_SECONDS } from "../config";
import { getAgentById } from "../db";
import { addAuditEvent } from "../services/audit";
import { createToken } from "../services/token";
import { Environment, TokenClaims } from "../types";

function isEnvironment(value: string): value is Environment {
  return value === "dev" || value === "staging" || value === "prod";
}

export const tokensRouter = Router();

tokensRouter.post("/tokens/mint", async (req, res) => {
  const body = req.body as { tenantId?: string; agentId?: string };
  const agent = body.agentId ? await getAgentById(body.agentId) : undefined;

  if (!body.tenantId || !body.agentId || !agent || agent.tenantId !== body.tenantId) {
    res.status(400).json({ error: "valid tenantId and agentId are required" });
    return;
  }

  if (!isEnvironment(agent.environment)) {
    res.status(500).json({ error: "Agent has invalid environment" });
    return;
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
