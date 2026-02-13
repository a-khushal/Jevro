import { Router } from "express";
import { validate } from "../middleware/validate";
import { addAuditEvent } from "../services/audit";
import { authorize } from "../services/authorize";
import { AuthorizeInput } from "../types";
import { authorizeSchema } from "../validation/schemas";

export const authorizeRouter = Router();

authorizeRouter.post("/authorize", validate({ body: authorizeSchema }), async (req, res) => {
  const body = req.body as AuthorizeInput;

  const decision = await authorize(body);
  await addAuditEvent({
    tenantId: body.tenantId,
    agentId: body.agentId,
    eventType: "policy.evaluated",
    connector: body.connector,
    action: body.action,
    status: decision === "deny" ? "failure" : "success",
    details: { decision, environment: body.environment }
  });

  res.status(200).json({ decision });
});
