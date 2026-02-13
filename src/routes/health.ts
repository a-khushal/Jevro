import { Router } from "express";
import { nowIso } from "../utils/time";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "okta-for-agents-mvp", timestamp: nowIso() });
});
