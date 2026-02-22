import { Router } from "express";
import { upsertConnectorCredential } from "../db";
import { validate } from "../middleware/validate";
import { addAuditEvent } from "../services/audit";
import { getConnectorHealthForTenant, isSupportedConnector } from "../services/connectors";
import { connectorHealthQuerySchema, upsertGithubCredentialSchema, upsertJiraCredentialSchema, upsertSlackCredentialSchema } from "../validation/schemas";

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

connectorsRouter.post(
  "/connectors/slack/credentials",
  validate({ body: upsertSlackCredentialSchema }),
  async (req, res) => {
    const body = req.body as { tenantId: string; token: string };

    const credential = await upsertConnectorCredential({
      tenantId: body.tenantId,
      connector: "slack",
      token: body.token
    });

    await addAuditEvent({
      tenantId: body.tenantId,
      eventType: "connector.credentials.upserted",
      connector: "slack",
      status: "success",
      details: {
        credentialId: credential.id
      }
    });

    res.status(200).json({
      connector: "slack",
      tenantId: credential.tenantId,
      updatedAt: credential.updatedAt.toISOString()
    });
  }
);

connectorsRouter.post(
  "/connectors/jira/credentials",
  validate({ body: upsertJiraCredentialSchema }),
  async (req, res) => {
    const body = req.body as { tenantId: string; token: string };

    const credential = await upsertConnectorCredential({
      tenantId: body.tenantId,
      connector: "jira",
      token: body.token
    });

    await addAuditEvent({
      tenantId: body.tenantId,
      eventType: "connector.credentials.upserted",
      connector: "jira",
      status: "success",
      details: {
        credentialId: credential.id
      }
    });

    res.status(200).json({
      connector: "jira",
      tenantId: credential.tenantId,
      updatedAt: credential.updatedAt.toISOString()
    });
  }
);

connectorsRouter.get("/connectors/health", validate({ query: connectorHealthQuerySchema }), async (req, res) => {
  const tenantId = req.query.tenantId as string;
  const connectors = ["github", "slack", "jira", "postgres"];

  const result = await Promise.all(
    connectors
      .filter((connector) => isSupportedConnector(connector))
      .map((connector) => getConnectorHealthForTenant({ tenantId, connector }))
  );

  res.status(200).json({
    tenantId,
    connectors: result
  });
});
