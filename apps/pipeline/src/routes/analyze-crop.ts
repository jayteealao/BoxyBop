import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { createGeminiClient, type CropAnalysisInput } from "@boxybop/shared";
import {
  CropAnalysisSchema,
  StyleGuideLockedSchema,
  type CropAnalysis,
  type StyleGuideLocked,
} from "@boxybop/ir";
import { getEnv } from "../config/env.js";

export const analyzeCropRouter: IRouter = Router();

/**
 * Request body schema for analyze-crop endpoint.
 */
const AnalyzeCropRequestSchema = z.object({
  setId: z.string().min(1),
  cropId: z.string().uuid(),
  cropPngBase64: z.string().min(1),
  cropSha256: z.string().regex(/^[a-f0-9]{64}$/, "Must be valid SHA-256 hex"),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  /** Path to runs directory (default: ./runs) */
  runsDir: z.string().optional(),
  /** Style run ID to load locked tokens from */
  styleRunId: z.string().min(1),
  /** Full screenshot dimensions for this set (to reject full screenshots) */
  fullScreenshotDimensions: z.array(
    z.object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    })
  ).min(1),
});

type AnalyzeCropRequest = z.infer<typeof AnalyzeCropRequestSchema>;

/**
 * Response schema for analyze-crop endpoint.
 */
const AnalyzeCropResponseSchema = z.object({
  cropAnalysis: CropAnalysisSchema,
  promptVersion: z.string(),
  lockedTokensHash: z.string(),
  latency: z.object({
    geminiMs: z.number(),
    totalMs: z.number(),
  }),
});

type AnalyzeCropResponse = z.infer<typeof AnalyzeCropResponseSchema>;

/**
 * Check if dimensions match any full screenshot dimensions.
 */
function isFullScreenshot(
  width: number,
  height: number,
  fullDimensions: Array<{ width: number; height: number }>
): boolean {
  return fullDimensions.some(
    (dim) => dim.width === width && dim.height === height
  );
}

/**
 * Load locked style guide from disk.
 */
async function loadLockedStyleGuide(
  runsDir: string,
  styleRunId: string
): Promise<StyleGuideLocked> {
  const lockedTokensPath = path.join(runsDir, styleRunId, "style", "locked_tokens.json");

  try {
    const content = await fs.readFile(lockedTokensPath, "utf-8");
    const parsed = JSON.parse(content);

    const validation = StyleGuideLockedSchema.safeParse(parsed);
    if (!validation.success) {
      throw new Error(`Invalid locked style guide: ${validation.error.message}`);
    }

    return validation.data;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Locked tokens not found for style run ${styleRunId}`);
    }
    throw err;
  }
}

/**
 * POST /api/analyze-crop
 *
 * Analyze a cropped UI element using locked tokens as reference.
 *
 * The model will describe what it sees using ONLY the locked design tokens.
 * This ensures consistency with the established design system.
 *
 * CRITICAL: Rejects crops that match full screenshot dimensions.
 * Only cropped regions should be analyzed, not full screenshots.
 */
analyzeCropRouter.post("/", async (req: Request, res: Response): Promise<void> => {
  const totalStartTime = Date.now();

  // Validate request body
  const parseResult = AnalyzeCropRequestSchema.safeParse(req.body);
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
      error: "Crop analysis not available",
      message: "GEMINI_API_KEY is not configured",
    });
    return;
  }

  const {
    setId,
    cropId,
    cropPngBase64,
    cropSha256,
    width,
    height,
    runsDir = "./runs",
    styleRunId,
    fullScreenshotDimensions,
  } = parseResult.data;

  console.log(`[AnalyzeCrop] Starting analysis for crop ${cropId}`);
  console.log(`[AnalyzeCrop] Dimensions: ${width}x${height}`);
  console.log(`[AnalyzeCrop] Style run: ${styleRunId}`);

  // CRITICAL: Reject full screenshots
  if (isFullScreenshot(width, height, fullScreenshotDimensions)) {
    console.warn(`[AnalyzeCrop] REJECTED: Crop ${cropId} matches full screenshot dimensions`);
    res.status(400).json({
      error: "Full screenshot rejected",
      message: "Crop dimensions match full screenshot dimensions. Only cropped regions are allowed.",
      cropDimensions: { width, height },
      matchedDimensions: fullScreenshotDimensions.find(
        (d) => d.width === width && d.height === height
      ),
    });
    return;
  }

  try {
    // Load locked style guide
    console.log(`[AnalyzeCrop] Loading locked tokens from ${styleRunId}...`);
    const lockedStyleGuide = await loadLockedStyleGuide(runsDir, styleRunId);
    console.log(`[AnalyzeCrop] Loaded locked tokens (hash: ${lockedStyleGuide.tokensHash.slice(0, 12)}...)`);

    // Prepare input for Gemini
    const cropInput: CropAnalysisInput = {
      base64: cropPngBase64,
      cropId,
      setId,
      cropHash: cropSha256,
      width,
      height,
      lockedTokens: {
        styleRunId,
        tokensHash: lockedStyleGuide.tokensHash,
        tokens: {
          colors: lockedStyleGuide.tokens.colors.map((c) => ({
            cssVar: c.cssVar,
            value: c.value,
            role: c.role,
          })),
          typography: lockedStyleGuide.tokens.typography.map((t) => ({
            cssVar: t.cssVar,
            fontSize: t.fontSize,
            fontWeight: t.fontWeight,
          })),
          spacing: lockedStyleGuide.tokens.spacing.map((s) => ({
            cssVar: s.cssVar,
            value: s.value,
          })),
          radius: lockedStyleGuide.tokens.radius.map((r) => ({
            cssVar: r.cssVar,
            value: r.value,
          })),
          shadows: lockedStyleGuide.tokens.shadows.map((s) => ({
            cssVar: s.cssVar,
            value: s.value,
          })),
        },
      },
    };

    // Run Gemini analysis
    console.log("[AnalyzeCrop] Running Gemini analysis with locked tokens...");
    const geminiClient = createGeminiClient({ apiKey: env.GEMINI_API_KEY });
    const geminiResult = await geminiClient.analyzeCrop(cropInput);
    const geminiLatencyMs = geminiResult.latencyMs;

    console.log(`[AnalyzeCrop] Gemini analysis completed in ${geminiLatencyMs}ms`);
    console.log(`[AnalyzeCrop] Suggested component: ${geminiResult.analysis.suggestedComponentName || "none"}`);

    // Build CropAnalysis IR node
    const cropAnalysis: CropAnalysis = {
      id: randomUUID(),
      cropId,
      setId,
      cropHash: cropSha256,
      dimensions: { width, height },
      lockedTokensRef: {
        styleRunId,
        tokensHash: lockedStyleGuide.tokensHash,
      },
      model: geminiResult.model,
      promptVersion: geminiResult.promptVersion,
      analyzedAt: new Date().toISOString(),
      latencyMs: geminiLatencyMs,
      description: geminiResult.analysis.description,
      suggestedComponentName: geminiResult.analysis.suggestedComponentName,
      category: geminiResult.analysis.category as CropAnalysis["category"],
      elements: geminiResult.analysis.elements.map((e) => ({
        type: e.type as CropAnalysis["elements"][number]["type"],
        description: e.description,
        bounds: e.bounds,
        tokenRefs: e.tokenRefs.map((t) => ({
          cssVar: t.cssVar,
          context: t.context,
          confidence: t.confidence,
        })),
      })),
      colorTokensUsed: geminiResult.analysis.colorTokensUsed || [],
      typographyTokensUsed: geminiResult.analysis.typographyTokensUsed || [],
      spacingTokensUsed: geminiResult.analysis.spacingTokensUsed || [],
      radiusTokensUsed: geminiResult.analysis.radiusTokensUsed || [],
      shadowTokensUsed: geminiResult.analysis.shadowTokensUsed || [],
      states: (geminiResult.analysis.states || []) as CropAnalysis["states"],
      variants: geminiResult.analysis.variants || [],
      observations: {
        alignment: geminiResult.analysis.observations?.alignment as CropAnalysis["observations"]["alignment"],
        density: geminiResult.analysis.observations?.density as CropAnalysis["observations"]["density"],
        hasInteractiveIndicators: geminiResult.analysis.observations?.hasInteractiveIndicators,
        notes: geminiResult.analysis.observations?.notes,
      },
      rawResponse: geminiResult.analysis as unknown as Record<string, unknown>,
    };

    // Validate against schema
    const validation = CropAnalysisSchema.safeParse(cropAnalysis);
    if (!validation.success) {
      console.error("[AnalyzeCrop] Crop analysis validation failed:", validation.error);
      res.status(500).json({
        error: "Crop analysis validation failed",
        details: validation.error.issues,
      });
      return;
    }

    const totalLatencyMs = Date.now() - totalStartTime;

    console.log(`[AnalyzeCrop] Complete! Total time: ${totalLatencyMs}ms`);

    const response: AnalyzeCropResponse = {
      cropAnalysis,
      promptVersion: geminiResult.promptVersion,
      lockedTokensHash: lockedStyleGuide.tokensHash,
      latency: {
        geminiMs: geminiLatencyMs,
        totalMs: totalLatencyMs,
      },
    };

    res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[AnalyzeCrop] Failed:`, message);

    res.status(500).json({
      error: "Crop analysis failed",
      message,
      cropId,
    });
  }
});
