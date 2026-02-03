/**
 * POST /run-set - Full pipeline orchestration endpoint.
 *
 * Pipeline order:
 * 0) Ensure locked tokens exist
 * 1) OmniParser each image (full screenshots allowed here)
 * 2) Filter tiny boxes, dedupe by IoU
 * 3) Use manual crops or crop server-side
 * 4) Analyze each crop with locked tokens
 * 5) Write ir.json
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import {
  createOmniParserClient,
  createGeminiClient,
  createClaudeAgentClient,
  cropImageFromBase64,
  filterTinyBoxes,
  dedupeByIoU,
  computeSha256,
  type StyleAnalysisImage,
  type CropAnalysisInput,
} from "@boxybop/shared";
import {
  ParsedElementSchema,
  CropSpecSchema,
  CropArtifactSchema,
  CropAnalysisSchema,
  StyleGuideLockedSchema,
  StyleAnalysisGeminiSchema,
  type ParsedElement,
  type CropSpec,
  type CropArtifact,
  type CropAnalysis,
  type StyleGuideLocked,
  type StyleAnalysisGemini,
} from "@boxybop/ir";
import { getEnv } from "../config/env.js";
import { expensiveEndpointLimiter, MAX_BASE64_SIZE } from "../middleware/security.js";

export const runSetRouter: IRouter = Router();

// =============================================================================
// Schemas
// =============================================================================

const ImageInputSchema = z.object({
  id: z.string().min(1),
  base64: z.string().min(1).max(MAX_BASE64_SIZE, {
    message: `Base64 payload exceeds maximum size of ${MAX_BASE64_SIZE} bytes (~10MB decoded)`,
  }),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const ManualCropSchema = z.object({
  id: z.string().uuid(),
  imageId: z.string().min(1),
  sourceElementId: z.string().uuid().optional(),
  region: z.object({
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  label: z.string().optional(),
});

const RunSetRequestSchema = z.object({
  /** Unique set ID */
  setId: z.string().min(1),
  /** Images to process */
  images: z.array(ImageInputSchema).min(1),
  /** Manual crops from Studio (optional) */
  manualCrops: z.array(ManualCropSchema).optional(),
  /** Existing style run ID (if already analyzed) */
  existingStyleRunId: z.string().optional(),
  /** Output directory (default: ./runs) */
  outputDir: z.string().optional(),
  /** OmniParser options */
  parseOptions: z.object({
    boxThreshold: z.number().min(0).max(1).optional(),
    iouThreshold: z.number().min(0).max(1).optional(),
  }).optional(),
  /** Minimum box dimensions for filtering */
  minBoxSize: z.object({
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  }).optional(),
  /** IoU threshold for deduplication */
  dedupeIouThreshold: z.number().min(0).max(1).optional(),
});

type RunSetRequest = z.infer<typeof RunSetRequestSchema>;

const RunSetResponseSchema = z.object({
  runId: z.string(),
  setId: z.string(),
  styleRunId: z.string(),
  irPath: z.string(),
  summary: z.object({
    imagesProcessed: z.number(),
    elementsDetected: z.number(),
    cropsAnalyzed: z.number(),
    tokensHash: z.string(),
  }),
  latency: z.object({
    styleMs: z.number(),
    parseMs: z.number(),
    cropAnalysisMs: z.number(),
    totalMs: z.number(),
  }),
});

type RunSetResponse = z.infer<typeof RunSetResponseSchema>;

// =============================================================================
// Helpers
// =============================================================================

async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

async function loadLockedStyleGuide(
  runsDir: string,
  styleRunId: string
): Promise<StyleGuideLocked | null> {
  const lockedTokensPath = path.join(runsDir, styleRunId, "style", "locked_tokens.json");
  try {
    const content = await fs.readFile(lockedTokensPath, "utf-8");
    const parsed = JSON.parse(content);
    const validation = StyleGuideLockedSchema.safeParse(parsed);
    return validation.success ? validation.data : null;
  } catch {
    return null;
  }
}

// =============================================================================
// Pipeline Steps
// =============================================================================

/**
 * Step 0: Ensure locked tokens exist, run style analysis if not.
 */
async function ensureLockedTokens(
  request: RunSetRequest,
  runsDir: string,
  env: ReturnType<typeof getEnv>
): Promise<{ styleRunId: string; lockedStyleGuide: StyleGuideLocked; geminiAnalysis: StyleAnalysisGemini; latencyMs: number }> {
  const startTime = Date.now();

  // Check if we have existing style run
  if (request.existingStyleRunId) {
    const existing = await loadLockedStyleGuide(runsDir, request.existingStyleRunId);
    if (existing) {
      console.log(`[RunSet] Using existing style run: ${request.existingStyleRunId}`);
      // Load gemini analysis too
      const geminiPath = path.join(runsDir, request.existingStyleRunId, "style", "gemini_analysis.json");
      const geminiContent = await fs.readFile(geminiPath, "utf-8");
      const geminiAnalysis = StyleAnalysisGeminiSchema.parse(JSON.parse(geminiContent));
      return {
        styleRunId: request.existingStyleRunId,
        lockedStyleGuide: existing,
        geminiAnalysis,
        latencyMs: Date.now() - startTime,
      };
    }
    console.warn(`[RunSet] Existing style run ${request.existingStyleRunId} not found, creating new one`);
  }

  // Run style analysis
  console.log("[RunSet] Step 0: Running style analysis (Gemini + Claude)...");

  if (!env.GEMINI_API_KEY || !env.ANTHROPIC_API_KEY) {
    throw new Error("GEMINI_API_KEY and ANTHROPIC_API_KEY required for style analysis");
  }

  const styleRunId = randomUUID();
  const styleDir = path.join(runsDir, styleRunId, "style");
  await ensureDir(styleDir);

  // Gemini analysis
  const geminiClient = createGeminiClient({ apiKey: env.GEMINI_API_KEY });
  const geminiImages: StyleAnalysisImage[] = request.images.map((img) => ({
    id: img.id,
    base64: img.base64,
    mimeType: img.mimeType,
  }));

  const geminiResult = await geminiClient.analyzeStyle(geminiImages);
  console.log(`[RunSet] Gemini analysis: ${geminiResult.analysis.colors.length} colors, ${geminiResult.analysis.typography.length} typography`);

  const geminiAnalysis: StyleAnalysisGemini = {
    id: randomUUID(),
    imageSetId: request.setId,
    model: geminiResult.model,
    promptVersion: geminiResult.promptVersion,
    analyzedAt: new Date().toISOString(),
    latencyMs: geminiResult.latencyMs,
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
    spacing: geminiResult.analysis.spacing,
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
  };

  // Claude refinement
  const claudeClient = createClaudeAgentClient({ apiKey: env.ANTHROPIC_API_KEY });
  const claudeResult = await claudeClient.refineStyle({ geminiAnalysis, styleRunId });
  console.log(`[RunSet] Claude refinement: ${claudeResult.styleGuide.tokens.colors.length} color tokens`);

  const lockedStyleGuide = claudeResult.styleGuide;

  // Save artifacts
  await fs.writeFile(
    path.join(styleDir, "gemini_analysis.json"),
    JSON.stringify(geminiAnalysis, null, 2)
  );
  await fs.writeFile(
    path.join(styleDir, "locked_tokens.json"),
    JSON.stringify(lockedStyleGuide, null, 2)
  );
  await fs.writeFile(
    path.join(styleDir, "style-guide.md"),
    claudeResult.styleGuideMd
  );
  await fs.writeFile(
    path.join(styleDir, "design.md"),
    claudeResult.designMd
  );

  // Make locked_tokens.json read-only
  try {
    await fs.chmod(path.join(styleDir, "locked_tokens.json"), 0o444);
  } catch {
    // Ignore permission errors
  }

  return {
    styleRunId,
    lockedStyleGuide,
    geminiAnalysis,
    latencyMs: Date.now() - startTime,
  };
}

/**
 * Step 1: Run OmniParser on each image.
 */
async function parseImages(
  request: RunSetRequest,
  env: ReturnType<typeof getEnv>
): Promise<{ elements: Map<string, ParsedElement[]>; latencyMs: number }> {
  const startTime = Date.now();
  console.log(`[RunSet] Step 1: Parsing ${request.images.length} images with OmniParser...`);

  if (!env.REPLICATE_API_TOKEN) {
    throw new Error("REPLICATE_API_TOKEN required for OmniParser");
  }

  const omniClient = createOmniParserClient({ apiToken: env.REPLICATE_API_TOKEN });
  const elements = new Map<string, ParsedElement[]>();

  for (const image of request.images) {
    console.log(`[RunSet] Parsing image ${image.id} (${image.width}x${image.height})...`);

    const result = await omniClient.parseScreenshotBase64(
      image.base64,
      image.width,
      image.height,
      {
        box_threshold: request.parseOptions?.boxThreshold,
        iou_threshold: request.parseOptions?.iouThreshold,
      }
    );

    // Convert to ParsedElement IR nodes
    const parsed: ParsedElement[] = result.elements.map((el, idx) => ({
      id: randomUUID(),
      source: "omniparser" as const,
      imageId: image.id,
      bbox: {
        x: el.bbox.x,
        y: el.bbox.y,
        width: el.bbox.width,
        height: el.bbox.height,
      },
      elementType: mapElementType(el.type),
      rawLabel: el.type,
      confidence: el.confidence ?? 0.5,
      parserIndex: idx,
    }));

    elements.set(image.id, parsed);
    console.log(`[RunSet] Image ${image.id}: ${parsed.length} elements detected`);
  }

  return { elements, latencyMs: Date.now() - startTime };
}

/**
 * Map OmniParser element type to IR ElementType.
 */
function mapElementType(type: string | undefined): ParsedElement["elementType"] {
  if (!type) return "unknown";

  const lower = type.toLowerCase();
  const mapping: Record<string, ParsedElement["elementType"]> = {
    button: "button",
    input: "input",
    text: "text",
    image: "image",
    icon: "icon",
    card: "card",
    container: "container",
    navigation: "navigation",
    nav: "navigation",
    header: "header",
    footer: "footer",
    list: "list",
    "list-item": "list-item",
    checkbox: "checkbox",
    radio: "radio",
    toggle: "toggle",
    slider: "slider",
    dropdown: "dropdown",
    select: "dropdown",
    modal: "modal",
    tooltip: "tooltip",
    badge: "badge",
    avatar: "avatar",
    divider: "divider",
  };

  return mapping[lower] ?? "unknown";
}

/**
 * Step 2: Filter and dedupe elements.
 */
function filterAndDedupeElements(
  elements: Map<string, ParsedElement[]>,
  minWidth: number,
  minHeight: number,
  iouThreshold: number
): Map<string, ParsedElement[]> {
  console.log("[RunSet] Step 2: Filtering and deduping elements...");

  const filtered = new Map<string, ParsedElement[]>();

  for (const [imageId, imageElements] of elements) {
    // Filter tiny boxes
    const sizFiltered = imageElements.filter(
      (el) => el.bbox.width >= minWidth && el.bbox.height >= minHeight
    );

    // Dedupe by IoU
    const deduped = dedupeByIoU(sizFiltered, iouThreshold);

    filtered.set(imageId, deduped);
    console.log(`[RunSet] Image ${imageId}: ${imageElements.length} -> ${deduped.length} after filter/dedupe`);
  }

  return filtered;
}

/**
 * Step 3: Generate crops (use manual or auto-generate from elements).
 */
async function generateCrops(
  request: RunSetRequest,
  elements: Map<string, ParsedElement[]>
): Promise<{ cropSpecs: CropSpec[]; artifacts: CropArtifact[] }> {
  console.log("[RunSet] Step 3: Generating crops...");

  const cropSpecs: CropSpec[] = [];
  const artifacts: CropArtifact[] = [];

  // Use manual crops if provided
  if (request.manualCrops && request.manualCrops.length > 0) {
    console.log(`[RunSet] Using ${request.manualCrops.length} manual crops from Studio`);

    for (const manual of request.manualCrops) {
      const image = request.images.find((img) => img.id === manual.imageId);
      if (!image) {
        console.warn(`[RunSet] Manual crop ${manual.id} references unknown image ${manual.imageId}`);
        continue;
      }

      const cropSpec: CropSpec = {
        id: manual.id,
        imageId: manual.imageId,
        sourceElementId: manual.sourceElementId,
        region: manual.region,
        label: manual.label,
        humanAdjusted: true,
        updatedAt: new Date().toISOString(),
      };
      cropSpecs.push(cropSpec);

      // Generate crop artifact
      const cropResult = await cropImageFromBase64(image.base64, manual.region);
      const artifact: CropArtifact = {
        id: randomUUID(),
        cropSpecId: manual.id,
        sourceImageId: manual.imageId,
        storagePath: `crops/${manual.id}.png`,
        contentHash: cropResult.sha256,
        dimensions: cropResult.dimensions,
        fileSizeBytes: cropResult.sizeBytes,
        createdAt: new Date().toISOString(),
      };
      // Store base64 temporarily for analysis
      (artifact as CropArtifact & { _pngBase64: string })._pngBase64 = cropResult.pngBase64;
      artifacts.push(artifact);
    }
  } else {
    // Auto-generate crops from elements
    console.log("[RunSet] Auto-generating crops from detected elements");

    for (const [imageId, imageElements] of elements) {
      const image = request.images.find((img) => img.id === imageId);
      if (!image) continue;

      for (const element of imageElements) {
        // Skip elements that match full screenshot dimensions
        if (
          element.bbox.width === image.width &&
          element.bbox.height === image.height
        ) {
          continue;
        }

        const cropSpec: CropSpec = {
          id: randomUUID(),
          imageId,
          sourceElementId: element.id,
          region: element.bbox,
          label: element.rawLabel,
          humanAdjusted: false,
          updatedAt: new Date().toISOString(),
        };
        cropSpecs.push(cropSpec);

        // Generate crop artifact
        const cropResult = await cropImageFromBase64(image.base64, element.bbox);
        const artifact: CropArtifact = {
          id: randomUUID(),
          cropSpecId: cropSpec.id,
          sourceImageId: imageId,
          storagePath: `crops/${cropSpec.id}.png`,
          contentHash: cropResult.sha256,
          dimensions: cropResult.dimensions,
          fileSizeBytes: cropResult.sizeBytes,
          createdAt: new Date().toISOString(),
        };
        (artifact as CropArtifact & { _pngBase64: string })._pngBase64 = cropResult.pngBase64;
        artifacts.push(artifact);
      }
    }
  }

  console.log(`[RunSet] Generated ${cropSpecs.length} crop specs and ${artifacts.length} artifacts`);
  return { cropSpecs, artifacts };
}

/**
 * Step 4: Analyze each crop with locked tokens.
 */
async function analyzeCrops(
  request: RunSetRequest,
  artifacts: CropArtifact[],
  lockedStyleGuide: StyleGuideLocked,
  styleRunId: string,
  env: ReturnType<typeof getEnv>
): Promise<{ analyses: CropAnalysis[]; latencyMs: number }> {
  const startTime = Date.now();
  console.log(`[RunSet] Step 4: Analyzing ${artifacts.length} crops with locked tokens...`);

  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY required for crop analysis");
  }

  const geminiClient = createGeminiClient({ apiKey: env.GEMINI_API_KEY });
  const analyses: CropAnalysis[] = [];

  // Get full screenshot dimensions for rejection check
  const fullScreenshotDimensions = request.images.map((img) => ({
    width: img.width,
    height: img.height,
  }));

  for (const artifact of artifacts) {
    // Skip if dimensions match full screenshot
    const matchesFull = fullScreenshotDimensions.some(
      (d) =>
        d.width === artifact.dimensions.width &&
        d.height === artifact.dimensions.height
    );
    if (matchesFull) {
      console.log(`[RunSet] Skipping artifact ${artifact.id} - matches full screenshot dimensions`);
      continue;
    }

    const pngBase64 = (artifact as CropArtifact & { _pngBase64?: string })._pngBase64;
    if (!pngBase64) {
      console.warn(`[RunSet] No PNG data for artifact ${artifact.id}`);
      continue;
    }

    console.log(`[RunSet] Analyzing crop ${artifact.cropSpecId} (${artifact.dimensions.width}x${artifact.dimensions.height})...`);

    try {
      const input: CropAnalysisInput = {
        base64: pngBase64,
        cropId: artifact.cropSpecId,
        setId: request.setId,
        cropHash: artifact.contentHash,
        width: artifact.dimensions.width,
        height: artifact.dimensions.height,
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

      const result = await geminiClient.analyzeCrop(input);

      const cropAnalysis: CropAnalysis = {
        id: randomUUID(),
        cropId: artifact.cropSpecId,
        setId: request.setId,
        cropHash: artifact.contentHash,
        dimensions: artifact.dimensions,
        lockedTokensRef: {
          styleRunId,
          tokensHash: lockedStyleGuide.tokensHash,
        },
        model: result.model,
        promptVersion: result.promptVersion,
        analyzedAt: new Date().toISOString(),
        latencyMs: result.latencyMs,
        description: result.analysis.description,
        styleDescription: result.analysis.styleDescription,
        suggestedComponentName: result.analysis.suggestedComponentName,
        category: result.analysis.category as CropAnalysis["category"],
        elements: result.analysis.elements.map((e) => ({
          type: e.type as CropAnalysis["elements"][number]["type"],
          description: e.description,
          bounds: e.bounds,
          tokenRefs: e.tokenRefs,
        })),
        colorTokensUsed: result.analysis.colorTokensUsed || [],
        typographyTokensUsed: result.analysis.typographyTokensUsed || [],
        spacingTokensUsed: result.analysis.spacingTokensUsed || [],
        radiusTokensUsed: result.analysis.radiusTokensUsed || [],
        shadowTokensUsed: result.analysis.shadowTokensUsed || [],
        states: (result.analysis.states || []) as CropAnalysis["states"],
        variants: result.analysis.variants || [],
        observations: {
          alignment: result.analysis.observations?.alignment as CropAnalysis["observations"]["alignment"],
          density: result.analysis.observations?.density as CropAnalysis["observations"]["density"],
          hasInteractiveIndicators: result.analysis.observations?.hasInteractiveIndicators,
          notes: result.analysis.observations?.notes,
        },
      };

      analyses.push(cropAnalysis);
    } catch (err) {
      console.error(`[RunSet] Failed to analyze crop ${artifact.cropSpecId}:`, err);
      // Continue with other crops
    }
  }

  console.log(`[RunSet] Analyzed ${analyses.length} crops`);
  return { analyses, latencyMs: Date.now() - startTime };
}

// =============================================================================
// Route Handler
// =============================================================================

/**
 * POST /api/run-set
 *
 * Run the full pipeline on a set of images.
 *
 * Output: runs/<run_id>/ir.json with all pipeline artifacts.
 *
 * SECURITY:
 * - Rate limited (5 requests/minute) to prevent API cost abuse
 * - Base64 payloads limited to ~10MB each to prevent memory exhaustion
 */
runSetRouter.post("/", expensiveEndpointLimiter, async (req: Request, res: Response): Promise<void> => {
  const totalStartTime = Date.now();

  // Validate request
  const parseResult = RunSetRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: "Invalid request",
      details: parseResult.error.issues,
    });
    return;
  }

  const request = parseResult.data;
  const env = getEnv();
  const runsDir = request.outputDir || "./runs";
  const runId = randomUUID();
  const runDir = path.join(runsDir, runId);

  console.log(`[RunSet] Starting pipeline run ${runId} for set ${request.setId}`);
  console.log(`[RunSet] Images: ${request.images.length}, Manual crops: ${request.manualCrops?.length ?? 0}`);

  try {
    await ensureDir(runDir);

    // Step 0: Ensure locked tokens
    const styleResult = await ensureLockedTokens(request, runsDir, env);
    console.log(`[RunSet] Style run: ${styleResult.styleRunId} (${styleResult.latencyMs}ms)`);

    // Step 1: Parse images
    const parseResult = await parseImages(request, env);
    console.log(`[RunSet] Parsing complete (${parseResult.latencyMs}ms)`);

    // Step 2: Filter and dedupe
    const minWidth = request.minBoxSize?.width ?? 20;
    const minHeight = request.minBoxSize?.height ?? 20;
    const iouThreshold = request.dedupeIouThreshold ?? 0.5;
    const filteredElements = filterAndDedupeElements(
      parseResult.elements,
      minWidth,
      minHeight,
      iouThreshold
    );

    // Step 3: Generate crops
    const cropsResult = await generateCrops(request, filteredElements);

    // Step 4: Analyze crops
    const analysisResult = await analyzeCrops(
      request,
      cropsResult.artifacts,
      styleResult.lockedStyleGuide,
      styleResult.styleRunId,
      env
    );

    // Step 5: Write ir.json
    const irData = {
      id: runId,
      setId: request.setId,
      createdAt: new Date().toISOString(),

      // Style references
      lockedTokensRef: {
        styleRunId: styleResult.styleRunId,
        tokensHash: styleResult.lockedStyleGuide.tokensHash,
      },
      styleGuideRef: {
        path: path.join(runsDir, styleResult.styleRunId, "style", "locked_tokens.json"),
        id: styleResult.lockedStyleGuide.id,
      },

      // Image metadata
      images: request.images.map((img) => ({
        id: img.id,
        mimeType: img.mimeType,
        dimensions: { width: img.width, height: img.height },
      })),

      // OmniParser results
      omniparserResults: Object.fromEntries(
        Array.from(filteredElements.entries()).map(([imageId, elements]) => [
          imageId,
          elements.map((el) => ParsedElementSchema.parse(el)),
        ])
      ),

      // Crops
      cropSpecs: cropsResult.cropSpecs.map((cs) => CropSpecSchema.parse(cs)),
      cropArtifacts: cropsResult.artifacts.map((a) => {
        // Remove temporary _pngBase64 before storing
        const { _pngBase64, ...clean } = a as CropArtifact & { _pngBase64?: string };
        return CropArtifactSchema.parse(clean);
      }),

      // Crop analyses
      cropAnalyses: analysisResult.analyses.map((ca) => CropAnalysisSchema.parse(ca)),

      // Pipeline metadata
      pipelineMetadata: {
        totalLatencyMs: Date.now() - totalStartTime,
        styleLatencyMs: styleResult.latencyMs,
        parseLatencyMs: parseResult.latencyMs,
        cropAnalysisLatencyMs: analysisResult.latencyMs,
        filterSettings: {
          minBoxWidth: minWidth,
          minBoxHeight: minHeight,
          dedupeIouThreshold: iouThreshold,
        },
      },
    };

    const irPath = path.join(runDir, "ir.json");
    await fs.writeFile(irPath, JSON.stringify(irData, null, 2));
    console.log(`[RunSet] Written ir.json to ${irPath}`);

    // Also save crops to disk
    const cropsDir = path.join(runDir, "crops");
    await ensureDir(cropsDir);
    for (const artifact of cropsResult.artifacts) {
      const pngBase64 = (artifact as CropArtifact & { _pngBase64?: string })._pngBase64;
      if (pngBase64) {
        const cropPath = path.join(cropsDir, `${artifact.cropSpecId}.png`);
        await fs.writeFile(cropPath, Buffer.from(pngBase64, "base64"));
      }
    }

    const totalLatencyMs = Date.now() - totalStartTime;
    console.log(`[RunSet] Pipeline complete in ${totalLatencyMs}ms`);

    // Count total elements
    let totalElements = 0;
    for (const elements of filteredElements.values()) {
      totalElements += elements.length;
    }

    const response: RunSetResponse = {
      runId,
      setId: request.setId,
      styleRunId: styleResult.styleRunId,
      irPath,
      summary: {
        imagesProcessed: request.images.length,
        elementsDetected: totalElements,
        cropsAnalyzed: analysisResult.analyses.length,
        tokensHash: styleResult.lockedStyleGuide.tokensHash,
      },
      latency: {
        styleMs: styleResult.latencyMs,
        parseMs: parseResult.latencyMs,
        cropAnalysisMs: analysisResult.latencyMs,
        totalMs: totalLatencyMs,
      },
    };

    res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[RunSet] Pipeline failed:`, message);

    res.status(500).json({
      error: "Pipeline failed",
      message,
      runId,
      setId: request.setId,
    });
  }
});
