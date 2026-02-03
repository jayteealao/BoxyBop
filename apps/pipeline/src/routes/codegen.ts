/**
 * Codegen Routes.
 *
 * POST /codegen/v2 - Per-component generation with state tracking
 * GET /codegen/v2/status/:setSlug - Get generation status
 *
 * Input:
 * - runs/<run_id>/ir.json
 * - locked_tokens.json + tokens.css
 * - DESIGN_SYSTEM.md (from style analysis)
 * - Full source images for design grounding
 * - Crop images for detected components
 *
 * Output:
 * - packages/ui-<setSlug>/
 *   - tokens.css (matches locked tokens exactly)
 *   - components/ (shadcn style)
 *   - *.stories.tsx for every component
 *   - registry.json (shadcn format)
 *   - .codegen/state.json (generation state)
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  StyleGuideLockedSchema,
  CropAnalysisSchema,
  type CropAnalysis,
} from "@boxybop/ir";
import { getEnv } from "../config/env.js";
import { runGenerator, type GeneratorConfig } from "../codegen/generator.js";
import { expensiveEndpointLimiter } from "../middleware/security.js";

export const codegenRouter: IRouter = Router();

// =============================================================================
// Schemas
// =============================================================================

const CodegenV2RequestSchema = z.object({
  /** Run ID containing ir.json */
  runId: z.string().min(1),
  /** Set slug for package name (e.g., "my-app" -> packages/ui-my-app) */
  setSlug: z.string().regex(/^[a-z0-9-]+$/, "Must be lowercase with hyphens"),
  /** Output directory (default: ./packages) */
  outputDir: z.string().optional(),
  /** Runs directory (default: ./runs) */
  runsDir: z.string().optional(),
  /** Retry failed components */
  retryFailed: z.boolean().optional(),
  /** Maximum components to generate (for testing/debugging) */
  maxComponents: z.number().int().positive().optional(),
});

type CodegenV2Request = z.infer<typeof CodegenV2RequestSchema>;

// =============================================================================
// Route Handlers
// =============================================================================

/**
 * POST /codegen/v2 - Per-component generation with state tracking.
 *
 * This endpoint generates components one at a time with:
 * - Full source images for design grounding
 * - State tracking for resume/retry
 * - Deterministic output (temperature=0)
 * - Inferred components from pattern detection
 *
 * The endpoint is idempotent - calling it again will resume from where it left off.
 *
 * SECURITY:
 * - Rate limited (5 requests/minute) to prevent API cost abuse
 */
codegenRouter.post("/v2", expensiveEndpointLimiter, async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();

  // Validate request
  const parseResult = CodegenV2RequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: "Invalid request",
      details: parseResult.error.issues,
    });
    return;
  }

  const request = parseResult.data;
  const env = getEnv();
  const runsDir = request.runsDir || "./runs";
  const outputDir = request.outputDir || "./packages";

  if (!env.ANTHROPIC_API_KEY) {
    res.status(503).json({
      error: "Codegen not available",
      message: "ANTHROPIC_API_KEY is not configured",
    });
    return;
  }

  console.log(`[CodegenV2] Starting for run ${request.runId}, package ui-${request.setSlug}`);

  try {
    // Load ir.json
    const irPath = path.join(runsDir, request.runId, "ir.json");
    const irContent = await fs.readFile(irPath, "utf-8");
    const irData = JSON.parse(irContent);

    // Load locked tokens
    const styleRunId = irData.lockedTokensRef?.styleRunId;
    if (!styleRunId) {
      res.status(400).json({
        error: "Missing locked tokens",
        message: "ir.json does not contain lockedTokensRef",
      });
      return;
    }

    const lockedTokensPath = path.join(runsDir, styleRunId, "style", "locked_tokens.json");
    const lockedTokensContent = await fs.readFile(lockedTokensPath, "utf-8");
    const lockedTokens = StyleGuideLockedSchema.parse(JSON.parse(lockedTokensContent));

    // Parse crop analyses
    const cropAnalyses: CropAnalysis[] = (irData.cropAnalyses || []).map(
      (ca: unknown) => CropAnalysisSchema.parse(ca)
    );

    console.log(`[CodegenV2] Found ${cropAnalyses.length} crop analyses`);

    // Load source images
    const sourceImages: GeneratorConfig["sourceImages"] = [];
    const omniparserResults = irData.omniparserResults || [];

    for (const result of omniparserResults) {
      const imagePath = result.imagePath;
      if (imagePath) {
        try {
          const imageBuffer = await fs.readFile(imagePath);
          sourceImages.push({
            name: path.basename(imagePath),
            base64: imageBuffer.toString("base64"),
            width: result.width || 0,
            height: result.height || 0,
          });
          console.log(`[CodegenV2] Loaded source image: ${path.basename(imagePath)}`);
        } catch (err) {
          console.warn(`[CodegenV2] Failed to load source image ${imagePath}:`, err);
        }
      }
    }

    // Load crop images
    const cropImages: Record<string, string> = {};
    const cropsDir = path.join(runsDir, request.runId, "crops");

    try {
      const cropFiles = await fs.readdir(cropsDir);
      for (const file of cropFiles) {
        if (file.endsWith(".png")) {
          const cropId = path.basename(file, ".png");
          const cropPath = path.join(cropsDir, file);
          const cropBuffer = await fs.readFile(cropPath);
          cropImages[cropId] = cropBuffer.toString("base64");
        }
      }
      console.log(`[CodegenV2] Loaded ${Object.keys(cropImages).length} crop images`);
    } catch {
      console.log("[CodegenV2] No crops directory found, continuing without crop images");
    }

    // Build generator config
    const packageDir = path.join(outputDir, `ui-${request.setSlug}`);

    const config: GeneratorConfig = {
      outputDir: packageDir,
      setSlug: request.setSlug,
      styleRunId,
      lockedTokens,
      cropAnalyses,
      sourceImages,
      cropImages,
      tokensCssPath: path.join(runsDir, styleRunId, "style", "tokens.css"),
      designSystemMdPath: path.join(runsDir, styleRunId, "style", "design.md"),
      anthropicApiKey: env.ANTHROPIC_API_KEY,
      retryFailed: request.retryFailed,
      maxComponents: request.maxComponents,
    };

    // Run generator
    const result = await runGenerator(config);

    const totalLatencyMs = Date.now() - startTime;
    console.log(`[CodegenV2] Complete in ${totalLatencyMs}ms`);

    res.json({
      success: result.success,
      packagePath: result.outputDir,
      progress: result.progress,
      errors: result.errors,
      state: {
        runId: result.state.runId,
        inputChecksum: result.state.inputChecksum,
        createdAt: result.state.createdAt,
        updatedAt: result.state.updatedAt,
      },
      latencyMs: totalLatencyMs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[CodegenV2] Failed:`, message);

    res.status(500).json({
      error: "Codegen failed",
      message,
      runId: request.runId,
    });
  }
});

/**
 * GET /codegen/v2/status/:setSlug
 *
 * Get the current generation status for a run.
 */
codegenRouter.get("/v2/status/:setSlug", async (req: Request, res: Response): Promise<void> => {
  const { setSlug } = req.params;
  const outputDir = (req.query.outputDir as string) || "./packages";

  const packageDir = path.join(outputDir, `ui-${setSlug}`);
  const statePath = path.join(packageDir, ".codegen", "state.json");

  try {
    const stateContent = await fs.readFile(statePath, "utf-8");
    const state = JSON.parse(stateContent);

    // Calculate progress
    let total = 0;
    let complete = 0;
    let failed = 0;

    // Tokens
    total += 1;
    if (state.phases.tokens.status === "complete") complete += 1;
    if (state.phases.tokens.status === "failed") failed += 1;

    // Primitives
    total += 1;
    if (state.phases.primitives.status === "complete") complete += 1;
    if (state.phases.primitives.status === "failed") failed += 1;

    // Detected
    for (const comp of Object.values(state.phases.detected) as Array<{ status: string }>) {
      total += 1;
      if (comp.status === "complete") complete += 1;
      if (comp.status === "failed") failed += 1;
    }

    // Inferred
    for (const comp of Object.values(state.phases.inferred) as Array<{ status: string }>) {
      total += 1;
      if (comp.status === "complete") complete += 1;
      if (comp.status === "failed") failed += 1;
    }

    // Utilities
    for (const comp of Object.values(state.phases.utilities) as Array<{ status: string }>) {
      total += 1;
      if (comp.status === "complete") complete += 1;
      if (comp.status === "failed") failed += 1;
    }

    // Registry
    total += 1;
    if (state.phases.registry.status === "complete") complete += 1;
    if (state.phases.registry.status === "failed") failed += 1;

    res.json({
      setSlug,
      packagePath: packageDir,
      state: {
        runId: state.runId,
        inputChecksum: state.inputChecksum,
        createdAt: state.createdAt,
        updatedAt: state.updatedAt,
      },
      progress: {
        total,
        complete,
        failed,
        pending: total - complete - failed,
        percentage: Math.round((complete / total) * 100),
      },
      phases: {
        tokens: state.phases.tokens.status,
        primitives: state.phases.primitives.status,
        detected: Object.fromEntries(
          Object.entries(state.phases.detected).map(([k, v]) => [k, (v as { status: string }).status])
        ),
        inferred: Object.fromEntries(
          Object.entries(state.phases.inferred).map(([k, v]) => [k, (v as { status: string }).status])
        ),
        utilities: Object.fromEntries(
          Object.entries(state.phases.utilities).map(([k, v]) => [k, (v as { status: string }).status])
        ),
        registry: state.phases.registry.status,
      },
    });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      res.status(404).json({
        error: "State not found",
        message: `No codegen state found for ui-${setSlug}`,
      });
      return;
    }
    throw err;
  }
});
