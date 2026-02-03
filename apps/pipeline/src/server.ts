import express from "express";
import cors from "cors";
import { healthRouter } from "./routes/health.js";
import { sessionsRouter } from "./routes/sessions.js";
import { parseRouter } from "./routes/parse.js";
import { analyzeStyleRouter } from "./routes/analyze-style.js";
import { analyzeCropRouter } from "./routes/analyze-crop.js";
import { runSetRouter } from "./routes/run-set.js";
import { codegenRouter } from "./routes/codegen.js";
import { uiPackagesRouter } from "./routes/ui-packages.js";
import { validateEnv } from "./config/env.js";
import { requestIdMiddleware, requestLoggingMiddleware, logger } from "./middleware/logging.js";

// Validate required environment variables
const env = validateEnv();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(requestIdMiddleware);
app.use(requestLoggingMiddleware);

// Routes
app.use("/api/health", healthRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/parse", parseRouter);
app.use("/api/analyze-style-set", analyzeStyleRouter);
app.use("/api/analyze-crop", analyzeCropRouter);
app.use("/api/run-set", runSetRouter);
app.use("/api/codegen", codegenRouter);
app.use("/api/ui-packages", uiPackagesRouter);

// Error handling
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
);

app.listen(PORT, () => {
  logger.info("Pipeline server started", {
    port: PORT,
    healthCheck: `http://localhost:${PORT}/api/health`,
    apis: {
      replicate: env.REPLICATE_API_TOKEN ? "configured" : "NOT configured",
      gemini: env.GEMINI_API_KEY ? "configured" : "NOT configured",
      anthropic: env.ANTHROPIC_API_KEY ? "configured" : "NOT configured",
    },
  });
});
