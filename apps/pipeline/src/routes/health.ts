import { Router, type IRouter } from "express";
import { getEnv } from "../config/env.js";

export const healthRouter: IRouter = Router();

healthRouter.get("/", (_req, res) => {
  const env = getEnv();

  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      replicate: env.REPLICATE_API_TOKEN ? "configured" : "not configured",
      gemini: env.GEMINI_API_KEY ? "configured" : "not configured",
      anthropic: env.ANTHROPIC_API_KEY ? "configured" : "not configured",
    },
  });
});
