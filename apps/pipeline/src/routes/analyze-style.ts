import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import {
  createGeminiClient,
  createClaudeAgentClient,
  type StyleAnalysisImage,
} from "@boxybop/shared";
import {
  StyleAnalysisGeminiSchema,
  StyleGuideLockedSchema,
  type StyleAnalysisGemini,
  type StyleGuideLocked,
} from "@boxybop/ir";
import { getEnv } from "../config/env.js";

export const analyzeStyleRouter: IRouter = Router();

/**
 * Request body schema for analyze-style-set endpoint
 */
const AnalyzeStyleRequestSchema = z.object({
  imageSetId: z.string().min(1),
  images: z.array(
    z.object({
      id: z.string().min(1),
      base64: z.string().min(1),
      mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
    })
  ).min(1),
  outputDir: z.string().min(1).optional(), // Where to store artifacts
});

type AnalyzeStyleRequest = z.infer<typeof AnalyzeStyleRequestSchema>;

/**
 * Response schema for analyze-style-set endpoint
 */
const AnalyzeStyleResponseSchema = z.object({
  styleRunId: z.string(),
  geminiAnalysisId: z.string(),
  lockedStyleGuideId: z.string(),
  artifactPaths: z.object({
    geminiAnalysis: z.string(),
    lockedStyleGuide: z.string(),
  }),
  latency: z.object({
    geminiMs: z.number(),
    claudeMs: z.number(),
    totalMs: z.number(),
  }),
});

type AnalyzeStyleResponse = z.infer<typeof AnalyzeStyleResponseSchema>;

/**
 * Ensure directory exists, creating it if necessary.
 */
async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * POST /api/analyze-style-set
 *
 * Analyze an image set for style tokens using Gemini + Claude.
 *
 * Flow:
 * 1. Gemini 2.0 Flash analyzes all images for raw style data
 * 2. Claude Opus refines the analysis into locked tokens
 * 3. Artifacts are stored under runs/<style_run_id>/style/
 *
 * CRITICAL: locked_tokens.json is IMMUTABLE after creation.
 * Later pipeline steps must treat it as read-only input.
 */
analyzeStyleRouter.post("/", async (req: Request, res: Response): Promise<void> => {
  const totalStartTime = Date.now();

  // Validate request body
  const parseResult = AnalyzeStyleRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: "Invalid request",
      details: parseResult.error.issues,
    });
    return;
  }

  const env = getEnv();

  // Check required API keys
  if (!env.GEMINI_API_KEY) {
    res.status(503).json({
      error: "Style analysis not available",
      message: "GEMINI_API_KEY is not configured",
    });
    return;
  }

  if (!env.ANTHROPIC_API_KEY) {
    res.status(503).json({
      error: "Style refinement not available",
      message: "ANTHROPIC_API_KEY is not configured",
    });
    return;
  }

  const { imageSetId, images, outputDir } = parseResult.data;
  const styleRunId = randomUUID();

  console.log(`[AnalyzeStyle] Starting style analysis for imageSet ${imageSetId}`);
  console.log(`[AnalyzeStyle] Style run ID: ${styleRunId}`);
  console.log(`[AnalyzeStyle] Processing ${images.length} images`);

  try {
    // Step 1: Gemini style analysis
    console.log("[AnalyzeStyle] Step 1: Running Gemini style analysis...");
    const geminiClient = createGeminiClient({ apiKey: env.GEMINI_API_KEY });

    const geminiImages: StyleAnalysisImage[] = images.map((img) => ({
      id: img.id,
      base64: img.base64,
      mimeType: img.mimeType,
    }));

    const geminiResult = await geminiClient.analyzeStyle(geminiImages);
    const geminiLatencyMs = geminiResult.latencyMs;

    console.log(`[AnalyzeStyle] Gemini analysis completed in ${geminiLatencyMs}ms`);
    console.log(`[AnalyzeStyle] Found ${geminiResult.analysis.colors.length} colors, ${geminiResult.analysis.typography.length} typography rules`);

    // Build StyleAnalysisGemini IR node
    const geminiAnalysis: StyleAnalysisGemini = {
      id: randomUUID(),
      imageSetId,
      model: geminiResult.model,
      promptVersion: geminiResult.promptVersion,
      analyzedAt: new Date().toISOString(),
      latencyMs: geminiLatencyMs,
      colors: geminiResult.analysis.colors.map((c) => ({
        role: c.role as StyleAnalysisGemini["colors"][number]["role"],
        value: c.value,
        observedIn: c.observedIn,
      })),
      typography: geminiResult.analysis.typography.map((t) => ({
        role: t.role as StyleAnalysisGemini["typography"][number]["role"],
        fontSizePx: t.fontSizePx,
        fontWeight: t.fontWeight,
        lineHeight: t.lineHeight,
        letterSpacing: t.letterSpacing,
      })),
      spacing: geminiResult.analysis.spacing.map((s) => ({
        name: s.name,
        valuePx: s.valuePx,
        contexts: s.contexts,
      })),
      borderRadiusPx: geminiResult.analysis.borderRadiusPx,
      shadows: geminiResult.analysis.shadows,
      zIndex: geminiResult.analysis.zIndex,
      motion: geminiResult.analysis.motion,
      componentRules: geminiResult.analysis.componentRules.map((r) => ({
        component: r.component as StyleAnalysisGemini["componentRules"][number]["component"],
        paddingPx: r.paddingPx,
        borderRadiusPx: r.borderRadiusPx,
        borderWidthPx: r.borderWidthPx,
        minHeightPx: r.minHeightPx,
        gapPx: r.gapPx,
        notes: r.notes,
      })),
      observations: {
        density: geminiResult.analysis.observations.density,
        contrast: geminiResult.analysis.observations.contrast,
        iconStyle: geminiResult.analysis.observations.iconStyle,
        focusStyle: geminiResult.analysis.observations.focusStyle,
        borderStyle: geminiResult.analysis.observations.borderStyle,
      },
      imageReferences: geminiResult.analysis.imageReferences,
      rawResponse: geminiResult.analysis as unknown as Record<string, unknown>,
    };

    // Validate against schema
    const geminiValidation = StyleAnalysisGeminiSchema.safeParse(geminiAnalysis);
    if (!geminiValidation.success) {
      console.error("[AnalyzeStyle] Gemini analysis validation failed:", geminiValidation.error);
      res.status(500).json({
        error: "Gemini analysis validation failed",
        details: geminiValidation.error.issues,
      });
      return;
    }

    // Step 2: Claude style refinement
    console.log("[AnalyzeStyle] Step 2: Running Claude style refinement...");
    const claudeClient = createClaudeAgentClient({ apiKey: env.ANTHROPIC_API_KEY });

    const claudeResult = await claudeClient.refineStyle({
      geminiAnalysis,
      styleRunId,
    });
    const claudeLatencyMs = claudeResult.latencyMs;

    console.log(`[AnalyzeStyle] Claude refinement completed in ${claudeLatencyMs}ms`);
    console.log(`[AnalyzeStyle] Generated ${claudeResult.styleGuide.tokens.colors.length} color tokens`);
    console.log(`[AnalyzeStyle] Generated ${claudeResult.styleGuide.componentGuides.length} component guides`);

    const lockedStyleGuide: StyleGuideLocked = claudeResult.styleGuide;

    // Validate against schema
    const styleGuideValidation = StyleGuideLockedSchema.safeParse(lockedStyleGuide);
    if (!styleGuideValidation.success) {
      console.error("[AnalyzeStyle] Style guide validation failed:", styleGuideValidation.error);
      res.status(500).json({
        error: "Style guide validation failed",
        details: styleGuideValidation.error.issues,
      });
      return;
    }

    // Step 3: Store artifacts
    const baseOutputDir = outputDir || "./runs";
    const styleDir = path.join(baseOutputDir, styleRunId, "style");
    await ensureDir(styleDir);

    const geminiAnalysisPath = path.join(styleDir, "gemini_analysis.json");
    const lockedStyleGuidePath = path.join(styleDir, "locked_tokens.json");

    await fs.writeFile(
      geminiAnalysisPath,
      JSON.stringify(geminiAnalysis, null, 2),
      "utf-8"
    );

    // CRITICAL: locked_tokens.json is IMMUTABLE
    // Set read-only permissions after writing
    await fs.writeFile(
      lockedStyleGuidePath,
      JSON.stringify(lockedStyleGuide, null, 2),
      "utf-8"
    );

    // Make locked_tokens.json read-only (permissions: 0o444)
    try {
      await fs.chmod(lockedStyleGuidePath, 0o444);
      console.log(`[AnalyzeStyle] Set read-only permissions on ${lockedStyleGuidePath}`);
    } catch (chmodErr) {
      console.warn("[AnalyzeStyle] Could not set read-only permissions:", chmodErr);
    }

    const totalLatencyMs = Date.now() - totalStartTime;

    console.log(`[AnalyzeStyle] Complete! Total time: ${totalLatencyMs}ms`);
    console.log(`[AnalyzeStyle] Artifacts stored in ${styleDir}`);

    const response: AnalyzeStyleResponse = {
      styleRunId,
      geminiAnalysisId: geminiAnalysis.id,
      lockedStyleGuideId: lockedStyleGuide.id,
      artifactPaths: {
        geminiAnalysis: geminiAnalysisPath,
        lockedStyleGuide: lockedStyleGuidePath,
      },
      latency: {
        geminiMs: geminiLatencyMs,
        claudeMs: claudeLatencyMs,
        totalMs: totalLatencyMs,
      },
    };

    res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[AnalyzeStyle] Failed:`, message);

    res.status(500).json({
      error: "Style analysis failed",
      message,
      styleRunId,
    });
  }
});

/**
 * GET /api/analyze-style-set/:styleRunId/locked-tokens
 *
 * Retrieve locked tokens for a style run.
 * Used by codegen to ensure it has locked tokens before generating.
 */
analyzeStyleRouter.get("/:styleRunId/locked-tokens", async (req: Request, res: Response): Promise<void> => {
  const { styleRunId } = req.params;
  const baseOutputDir = (req.query.outputDir as string) || "./runs";
  const lockedTokensPath = path.join(baseOutputDir, styleRunId, "style", "locked_tokens.json");

  try {
    const content = await fs.readFile(lockedTokensPath, "utf-8");
    const lockedStyleGuide = JSON.parse(content);

    // Validate it's a valid locked style guide
    const validation = StyleGuideLockedSchema.safeParse(lockedStyleGuide);
    if (!validation.success) {
      res.status(500).json({
        error: "Invalid locked style guide",
        details: validation.error.issues,
      });
      return;
    }

    res.json(lockedStyleGuide);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      res.status(404).json({
        error: "Locked tokens not found",
        message: `No locked_tokens.json found for style run ${styleRunId}`,
        styleRunId,
      });
      return;
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({
      error: "Failed to retrieve locked tokens",
      message,
      styleRunId,
    });
  }
});
