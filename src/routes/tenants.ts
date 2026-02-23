import { Router } from "express";
import { TOKEN_TTL_MAX_SECONDS, TOKEN_TTL_MIN_SECONDS } from "../config";
import { getTenantConfig, upsertTenantConfig } from "../db";
import { AppError } from "../errors";
import { validate } from "../middleware/validate";
import { addAuditEvent } from "../services/audit";
import { tenantConfigQuerySchema, tenantConfigSchema } from "../validation/schemas";

export const tenantsRouter = Router();

tenantsRouter.get("/tenants/config", validate({ query: tenantConfigQuerySchema }), async (req, res) => {
  const tenantId = req.query.tenantId as string;
  const config = await getTenantConfig(tenantId);

  res.status(200).json({
    tenantId,
    tokenTtlSeconds: config?.tokenTtlSeconds ?? null,
    minTokenTtlSeconds: TOKEN_TTL_MIN_SECONDS,
    maxTokenTtlSeconds: TOKEN_TTL_MAX_SECONDS
  });
});

tenantsRouter.post("/tenants/config", validate({ body: tenantConfigSchema }), async (req, res) => {
  const body = req.body as { tenantId: string; tokenTtlSeconds?: number };

  if (body.tokenTtlSeconds !== undefined) {
    if (body.tokenTtlSeconds < TOKEN_TTL_MIN_SECONDS || body.tokenTtlSeconds > TOKEN_TTL_MAX_SECONDS) {
      throw new AppError(
        400,
        "TOKEN_TTL_OUT_OF_RANGE",
        `tokenTtlSeconds must be between ${TOKEN_TTL_MIN_SECONDS} and ${TOKEN_TTL_MAX_SECONDS}`
      );
    }
  }

  const config = await upsertTenantConfig({
    tenantId: body.tenantId,
    tokenTtlSeconds: body.tokenTtlSeconds
  });

  await addAuditEvent({
    tenantId: body.tenantId,
    eventType: "tenant.config.updated",
    status: "success",
    details: {
      tokenTtlSeconds: config.tokenTtlSeconds
    }
  });

  res.status(200).json({
    tenantId: config.tenantId,
    tokenTtlSeconds: config.tokenTtlSeconds,
    updatedAt: config.updatedAt.toISOString()
  });
});
