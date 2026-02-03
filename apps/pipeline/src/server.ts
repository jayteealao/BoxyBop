import express from "express";
import cors from "cors";
import { healthRouter } from "./routes/health.js";
import { sessionsRouter } from "./routes/sessions.js";
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
});
