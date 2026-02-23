import cors from "cors";
import { randomUUID } from "crypto";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { CORS_ORIGINS, JSON_BODY_LIMIT, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS } from "./config";
import { errorHandler, notFoundHandler } from "./errors";
import { agentsRouter } from "./routes/agents";
import { adminRouter } from "./routes/admin";
import { approvalsRouter } from "./routes/approvals";
import { auditRouter } from "./routes/audit";
import { authorizeRouter } from "./routes/authorize";
import { connectorsRouter } from "./routes/connectors";
import { healthRouter } from "./routes/health";
import { policiesRouter } from "./routes/policies";
import { proxyRouter } from "./routes/proxy";
import { slackRouter } from "./routes/slack";
import { tenantsRouter } from "./routes/tenants";
import { tokensRouter } from "./routes/tokens";
import { logStructured } from "./services/logger";
import { recordHttpMetric } from "./services/metrics";
import { runWithRequestContext } from "./services/requestContext";

export const app = express();

app.use(helmet());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || CORS_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed by CORS"));
    }
  })
);

app.use(
  rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests", code: "RATE_LIMITED" }
  })
);

app.use(express.json({ limit: JSON_BODY_LIMIT }));

app.use((req, res, next) => {
  const requestIdHeader = req.header("x-request-id");
  const requestId = requestIdHeader && requestIdHeader.trim() ? requestIdHeader : randomUUID();
  const start = Date.now();

  res.setHeader("x-request-id", requestId);

  runWithRequestContext(requestId, () => {
    res.on("finish", () => {
      const durationMs = Date.now() - start;

      recordHttpMetric({
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs
      });

      logStructured("http.request", {
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs,
        tenantId: (req.body as { tenantId?: string } | undefined)?.tenantId ??
          (typeof req.query.tenantId === "string" ? req.query.tenantId : undefined)
      });
    });

    next();
  });
});

const apiRouters = [
  healthRouter,
  agentsRouter,
  policiesRouter,
  tokensRouter,
  authorizeRouter,
  proxyRouter,
  auditRouter,
  approvalsRouter,
  slackRouter,
  tenantsRouter,
  connectorsRouter
];

app.use(adminRouter);

for (const router of apiRouters) {
  app.use(router);
  app.use("/v1", router);
}

app.use(notFoundHandler);
app.use(errorHandler);
