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

// Validate required environment variables
const env = validateEnv();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));

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
  console.log(`Pipeline server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Replicate API: ${env.REPLICATE_API_TOKEN ? "configured" : "NOT configured"}`);
  console.log(`Gemini API: ${env.GEMINI_API_KEY ? "configured" : "NOT configured"}`);
  console.log(`Anthropic API: ${env.ANTHROPIC_API_KEY ? "configured" : "NOT configured"}`);
});
