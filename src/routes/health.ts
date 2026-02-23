import { Router } from "express";
import { getMetricsSnapshot, getMetricsSummary } from "../services/metrics";
import { getSecuritySignalSnapshot } from "../services/securityAlerts";
import { nowIso } from "../utils/time";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "okta-for-agents-mvp",
    timestamp: nowIso(),
    securitySignals: getSecuritySignalSnapshot()
  });
});

healthRouter.get("/metrics", (_req, res) => {
  res.status(200).json(getMetricsSnapshot());
});

healthRouter.get("/metrics/summary", (_req, res) => {
  res.status(200).json(getMetricsSummary());
});
