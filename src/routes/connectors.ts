import { Router } from "express";
import { upsertConnectorCredential } from "../db";
import { validate } from "../middleware/validate";
import { addAuditEvent } from "../services/audit";
import { upsertGithubCredentialSchema } from "../validation/schemas";

export const connectorsRouter = Router();

connectorsRouter.post(
  "/connectors/github/credentials",
  validate({ body: upsertGithubCredentialSchema }),
  async (req, res) => {
    const body = req.body as { tenantId: string; token: string };

    const credential = await upsertConnectorCredential({
      tenantId: body.tenantId,
      connector: "github",
      token: body.token
    });

    await addAuditEvent({
      tenantId: body.tenantId,
      eventType: "connector.credentials.upserted",
      connector: "github",
      status: "success",
      details: {
        credentialId: credential.id
      }
    });

    res.status(200).json({
      connector: "github",
      tenantId: credential.tenantId,
      updatedAt: credential.updatedAt.toISOString()
    });
  }
);
