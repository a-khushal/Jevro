import express, { NextFunction, Request, Response } from "express";
import { agentsRouter } from "./routes/agents";
import { approvalsRouter } from "./routes/approvals";
import { auditRouter } from "./routes/audit";
import { authorizeRouter } from "./routes/authorize";
import { healthRouter } from "./routes/health";
import { policiesRouter } from "./routes/policies";
import { proxyRouter } from "./routes/proxy";
import { tokensRouter } from "./routes/tokens";

export const app = express();

app.use(express.json());

app.use(healthRouter);
app.use(agentsRouter);
app.use(policiesRouter);
app.use(tokensRouter);
app.use(authorizeRouter);
app.use(proxyRouter);
app.use(auditRouter);
app.use(approvalsRouter);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : "Unexpected server error";
  res.status(500).json({ error: message });
});
