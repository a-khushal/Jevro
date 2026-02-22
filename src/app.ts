import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { CORS_ORIGINS, JSON_BODY_LIMIT, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS } from "./config";
import { errorHandler, notFoundHandler } from "./errors";
import { agentsRouter } from "./routes/agents";
import { approvalsRouter } from "./routes/approvals";
import { auditRouter } from "./routes/audit";
import { authorizeRouter } from "./routes/authorize";
import { connectorsRouter } from "./routes/connectors";
import { healthRouter } from "./routes/health";
import { policiesRouter } from "./routes/policies";
import { proxyRouter } from "./routes/proxy";
import { slackRouter } from "./routes/slack";
import { tokensRouter } from "./routes/tokens";

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
  connectorsRouter
];

for (const router of apiRouters) {
  app.use(router);
  app.use("/v1", router);
}

app.use(notFoundHandler);
app.use(errorHandler);
