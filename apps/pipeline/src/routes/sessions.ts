import { Router, type IRouter } from "express";

export const sessionsRouter: IRouter = Router();

// POST /api/sessions - Create a new session and upload images
sessionsRouter.post("/", (_req, res) => {
  // TODO: Implement session creation
  res.status(501).json({ error: "Not implemented" });
});

// GET /api/sessions/:id - Get session state
sessionsRouter.get("/:id", (req, res) => {
  const { id } = req.params;
  // TODO: Implement session retrieval
  res.status(501).json({ error: "Not implemented", sessionId: id });
});

// POST /api/sessions/:id/parse - Trigger OmniParser via Replicate
sessionsRouter.post("/:id/parse", (req, res) => {
  const { id } = req.params;
  // TODO: Implement OmniParser call
  res.status(501).json({ error: "Not implemented", sessionId: id });
});

// GET /api/sessions/:id/elements - Get parsed elements
sessionsRouter.get("/:id/elements", (req, res) => {
  const { id } = req.params;
  // TODO: Implement element retrieval
  res.status(501).json({ error: "Not implemented", sessionId: id });
});

// PUT /api/sessions/:id/crops - Submit adjusted crop specs
sessionsRouter.put("/:id/crops", (req, res) => {
  const { id } = req.params;
  // TODO: Implement crop submission
  res.status(501).json({ error: "Not implemented", sessionId: id });
});

// POST /api/sessions/:id/analyze - Trigger Gemini analysis
sessionsRouter.post("/:id/analyze", (req, res) => {
  const { id } = req.params;
  // TODO: Implement Gemini analysis
  res.status(501).json({ error: "Not implemented", sessionId: id });
});

// POST /api/sessions/:id/generate - Trigger code generation
sessionsRouter.post("/:id/generate", (req, res) => {
  const { id } = req.params;
  // TODO: Implement code generation
  res.status(501).json({ error: "Not implemented", sessionId: id });
});

// GET /api/sessions/:id/output - Download generated files
sessionsRouter.get("/:id/output", (req, res) => {
  const { id } = req.params;
  // TODO: Implement output download
  res.status(501).json({ error: "Not implemented", sessionId: id });
});
