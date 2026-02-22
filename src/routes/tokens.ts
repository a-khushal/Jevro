import { Router } from "express";
import { TOKEN_TTL_SECONDS } from "../config";
import { activateSigningKey, getAgentByTenantAndId, listSigningKeysMetadata } from "../db";
import { AppError } from "../errors";
import { validate } from "../middleware/validate";
import { addAuditEvent } from "../services/audit";
import { createManagedToken, revokeManagedToken, rotateManagedSigningKey } from "../services/token";
import { Environment } from "../types";
import {
  activateSigningKeyParamsSchema,
  createSigningKeySchema,
  mintTokenSchema,
  revokeTokenSchema
} from "../validation/schemas";

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
  const claims = {
    sub: agent.id,
    tenantId: agent.tenantId,
    env: agent.environment,
    iat,
    exp: iat + TOKEN_TTL_SECONDS
  };
  const managed = await createManagedToken(claims);

  await addAuditEvent({
    tenantId: agent.tenantId,
    agentId: agent.id,
    eventType: "token.minted",
    status: "success",
    details: {
      expiresInSeconds: TOKEN_TTL_SECONDS,
      kid: managed.kid,
      jti: managed.jti
    }
  });

  res.status(200).json({ token: managed.token, expiresInSeconds: TOKEN_TTL_SECONDS, kid: managed.kid, jti: managed.jti });
});

tokensRouter.post("/tokens/revoke", validate({ body: revokeTokenSchema }), async (req, res) => {
  const body = req.body as { tenantId: string; token: string; reason?: string };

  const revoked = await revokeManagedToken({
    tenantId: body.tenantId,
    token: body.token,
    reason: body.reason
  });

  if (!revoked) {
    throw new AppError(400, "INVALID_TOKEN", "Unable to revoke token");
  }

  await addAuditEvent({
    tenantId: body.tenantId,
    agentId: revoked.agentId,
    eventType: "token.revoked",
    status: "success",
    details: {
      jti: revoked.jti,
      expiresAt: revoked.expiresAt.toISOString(),
      reason: body.reason ?? null
    }
  });

  res.status(200).json({ revoked: true, jti: revoked.jti, expiresAt: revoked.expiresAt.toISOString() });
});

tokensRouter.get("/tokens/keys", async (_req, res) => {
  const keys = await listSigningKeysMetadata();
  res.status(200).json({
    count: keys.length,
    keys: keys.map((key: { kid: string; isActive: boolean; createdAt: Date; activatedAt: Date | null; deactivatedAt: Date | null }) => ({
      kid: key.kid,
      isActive: key.isActive,
      createdAt: key.createdAt.toISOString(),
      activatedAt: key.activatedAt ? key.activatedAt.toISOString() : null,
      deactivatedAt: key.deactivatedAt ? key.deactivatedAt.toISOString() : null
    }))
  });
});

tokensRouter.post("/tokens/keys", validate({ body: createSigningKeySchema }), async (req, res) => {
  const body = req.body as { kid: string; secret: string; activate?: boolean };

  await rotateManagedSigningKey({
    kid: body.kid,
    secret: body.secret,
    activate: body.activate ?? false
  });

  await addAuditEvent({
    tenantId: "system",
    eventType: "token.key.created",
    status: "success",
    details: {
      kid: body.kid,
      activate: body.activate ?? false
    }
  });

  res.status(201).json({ kid: body.kid, activate: body.activate ?? false });
});

tokensRouter.post(
  "/tokens/keys/:kid/activate",
  validate({ params: activateSigningKeyParamsSchema }),
  async (req, res) => {
    const kid = req.params.kid as string;
    const activated = await activateSigningKey(kid);
    if (!activated) {
      throw new AppError(404, "SIGNING_KEY_NOT_FOUND", "Signing key not found");
    }

    await addAuditEvent({
      tenantId: "system",
      eventType: "token.key.activated",
      status: "success",
      details: { kid }
    });

    res.status(200).json({ kid, active: true });
  }
);
