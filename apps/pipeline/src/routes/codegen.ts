/**
 * Codegen Routes.
 *
 * POST /codegen - Legacy batch generation (single Claude call)
 * POST /codegen/v2 - Per-component generation with state tracking
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
import { randomUUID, createHash } from "node:crypto";
import { query } from "@anthropic-ai/claude-agent-sdk";
import {
  StyleGuideLockedSchema,
  CropAnalysisSchema,
  CodegenResultSchema,
  type StyleGuideLocked,
  type CropAnalysis,
  type CodegenResult,
  type GeneratedFile,
  type ValidationResult,
} from "@boxybop/ir";
import { getEnv } from "../config/env.js";
import { runGenerator, type GeneratorConfig } from "../codegen/generator.js";
import { expensiveEndpointLimiter } from "../middleware/security.js";

export const codegenRouter: IRouter = Router();

const CODEGEN_PROMPT_VERSION = "1.0.0";
const CLAUDE_MODEL = "claude-opus-4-1-20250805";

// =============================================================================
// Schemas
// =============================================================================

const CodegenRequestSchema = z.object({
  /** Run ID containing ir.json */
  runId: z.string().min(1),
  /** Set slug for package name (e.g., "my-app" -> packages/ui-my-app) */
  setSlug: z.string().regex(/^[a-z0-9-]+$/, "Must be lowercase with hyphens"),
  /** Output directory (default: ./packages) */
  outputDir: z.string().optional(),
  /** Runs directory (default: ./runs) */
  runsDir: z.string().optional(),
  /** Components to generate (optional - if empty, generates all from ir.json) */
  components: z.array(z.string()).optional(),
  /** Skip validation (for testing) */
  skipValidation: z.boolean().optional(),
});

type CodegenRequest = z.infer<typeof CodegenRequestSchema>;

const CodegenResponseSchema = z.object({
  packagePath: z.string(),
  result: CodegenResultSchema,
});

type CodegenResponse = z.infer<typeof CodegenResponseSchema>;

// =============================================================================
// Token Validation
// =============================================================================

/**
 * Extract CSS custom properties from a CSS string.
 */
function extractCssVars(css: string): Set<string> {
  const vars = new Set<string>();
  const regex = /--[\w-]+/g;
  let match;
  while ((match = regex.exec(css)) !== null) {
    vars.add(match[0]);
  }
  return vars;
}

/**
 * Validate that generated tokens.css matches locked tokens.
 * Returns errors if new base tokens are introduced.
 */
function validateTokensCss(
  generatedCss: string,
  lockedTokens: StyleGuideLocked
): string[] {
  const errors: string[] = [];

  // Build set of allowed CSS vars from locked tokens
  const allowedVars = new Set<string>();
  for (const c of lockedTokens.tokens.colors) {
    allowedVars.add(c.cssVar);
  }
  for (const t of lockedTokens.tokens.typography) {
    allowedVars.add(t.cssVar);
  }
  for (const s of lockedTokens.tokens.spacing) {
    allowedVars.add(s.cssVar);
  }
  for (const r of lockedTokens.tokens.radius) {
    allowedVars.add(r.cssVar);
  }
  for (const sh of lockedTokens.tokens.shadows) {
    allowedVars.add(sh.cssVar);
  }
  for (const b of lockedTokens.tokens.borders) {
    allowedVars.add(b.cssVar);
  }
  for (const z of lockedTokens.tokens.zIndex) {
    allowedVars.add(z.cssVar);
  }
  for (const m of lockedTokens.tokens.motion) {
    allowedVars.add(m.cssVar);
  }

  // Extract vars from generated CSS
  const generatedVars = extractCssVars(generatedCss);

  // Check for new base tokens (definitions in :root)
  const rootBlockMatch = generatedCss.match(/:root\s*\{([^}]+)\}/);
  if (rootBlockMatch) {
    const rootBlock = rootBlockMatch[1];
    const definedInRoot = extractCssVars(rootBlock);

    for (const v of definedInRoot) {
      if (!allowedVars.has(v)) {
        errors.push(`New base token introduced: ${v} (not in locked tokens)`);
      }
    }
  }

  return errors;
}

/**
 * Verify all locked tokens are present in generated CSS.
 */
function verifyTokensComplete(
  generatedCss: string,
  lockedTokens: StyleGuideLocked
): string[] {
  const warnings: string[] = [];
  const generatedVars = extractCssVars(generatedCss);

  // Check colors
  for (const c of lockedTokens.tokens.colors) {
    if (!generatedVars.has(c.cssVar)) {
      warnings.push(`Missing color token: ${c.cssVar}`);
    }
  }

  // Check spacing
  for (const s of lockedTokens.tokens.spacing) {
    if (!generatedVars.has(s.cssVar)) {
      warnings.push(`Missing spacing token: ${s.cssVar}`);
    }
  }

  return warnings;
}

// =============================================================================
// Code Generation
// =============================================================================

/**
 * Build the system prompt for code generation.
 */
function buildCodegenSystemPrompt(
  lockedTokens: StyleGuideLocked,
  designMd: string,
  styleGuideMd: string
): string {
  return `You are an expert React/TypeScript component library generator. Your task is to generate a complete, production-ready UI component package.

## CRITICAL CONSTRAINTS

1. **TOKENS ARE LOCKED** - You MUST NOT introduce new base tokens. Only use the CSS custom properties defined in the locked tokens below.
2. **NO HARDCODED VALUES** - All colors, spacing, typography, radius, and shadows must reference token CSS variables.
3. **SHADCN STYLE** - Components should follow shadcn/ui patterns: composable, accessible, well-typed.
4. **AESTHETIC CONSISTENCY** - Follow the design philosophy described in the design document.

## LOCKED DESIGN TOKENS

\`\`\`json
${JSON.stringify(lockedTokens.tokens, null, 2)}
\`\`\`

## DESIGN PHILOSOPHY

${designMd}

## STYLE GUIDE

${styleGuideMd}

## OUTPUT REQUIREMENTS

Generate the following files:

### 1. src/tokens/tokens.css
CSS file with :root block defining all tokens. MUST match locked tokens exactly.

### 2. src/tokens/tokens.ts
TypeScript constants for token values.

### 3. src/tokens/index.ts
Export all tokens.

### 4. src/components/<ComponentName>.tsx
For each component:
- Use token CSS variables (var(--color-*), var(--space-*), etc.)
- Include proper TypeScript types/interfaces
- Add JSDoc comments
- Support variants, states as detected
- Use React.forwardRef for proper ref forwarding

### 5. src/components/<ComponentName>.stories.tsx
Storybook stories for each component:
- Default story
- All variants
- All states
- Interactive examples

### 6. registry.json
shadcn registry format:
\`\`\`json
{
  "$schema": "https://ui.shadcn.com/schema/registry.json",
  "name": "ui-package",
  "items": [
    {
      "name": "button",
      "type": "registry:ui",
      "files": [{"path": "src/components/Button.tsx", "type": "registry:component"}],
      "dependencies": []
    }
  ]
}
\`\`\`

### 7. package.json
Valid package.json with dependencies.

### 8. tsconfig.json
TypeScript config for the package.

### 9. README.md
Documentation for the component library.

## RESPONSE FORMAT

Respond with a JSON object containing all files:
\`\`\`json
{
  "files": [
    { "path": "src/tokens/tokens.css", "content": "..." },
    { "path": "src/components/Button.tsx", "content": "..." },
    ...
  ]
}
\`\`\`

Generate ALL files in a single response. Be thorough and complete.`;
}

/**
 * Build the user prompt with crop analyses.
 */
function buildCodegenUserPrompt(
  cropAnalyses: CropAnalysis[],
  requestedComponents?: string[]
): string {
  const componentsList = cropAnalyses
    .filter((ca) => ca.suggestedComponentName)
    .map((ca) => ({
      name: ca.suggestedComponentName,
      category: ca.category,
      description: ca.description,
      styleDescription: ca.styleDescription,
      tokens: {
        colors: ca.colorTokensUsed.map((t) => t.cssVar),
        typography: ca.typographyTokensUsed.map((t) => t.cssVar),
        spacing: ca.spacingTokensUsed.map((t) => t.cssVar),
        radius: ca.radiusTokensUsed.map((t) => t.cssVar),
        shadows: ca.shadowTokensUsed.map((t) => t.cssVar),
      },
      variants: ca.variants,
      states: ca.states,
    }));

  const filteredComponents = requestedComponents
    ? componentsList.filter((c) => requestedComponents.includes(c.name || ""))
    : componentsList;

  return `Generate a complete UI component package with the following components:

## Components to Generate

${JSON.stringify(filteredComponents, null, 2)}

## Instructions

1. Generate tokens.css with ALL locked tokens (from system prompt)
2. Generate each component listed above
3. Use the styleDescription to guide the aesthetic choices
4. Generate stories for each component
5. Generate registry.json listing all components
6. Generate package.json and tsconfig.json

Remember: NO new base tokens, only use the locked tokens provided.

Respond with the complete JSON containing all files.`;
}

// =============================================================================
// Route Handler (DEPRECATED)
// =============================================================================

/**
 * @deprecated Use POST /codegen/v2 instead.
 *
 * This endpoint uses batch generation (single Claude call) which is less
 * reliable for large component sets. The v2 endpoint generates components
 * one at a time with state tracking for resume/retry.
 *
 * This endpoint will be removed in a future version.
 */
codegenRouter.post("/", expensiveEndpointLimiter, async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();

  // Send deprecation warning header
  res.setHeader("Deprecation", "true");
  res.setHeader("Sunset", "2026-06-01");
  res.setHeader("Link", '</api/codegen/v2>; rel="successor-version"');

  console.warn("[Codegen] WARNING: POST /codegen is deprecated. Use POST /codegen/v2 instead.");

  // Validate request
  const parseResult = CodegenRequestSchema.safeParse(req.body);
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

  console.log(`[Codegen] Starting for run ${request.runId}, package ui-${request.setSlug}`);

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

    // Load design docs
    const styleDir = path.join(runsDir, styleRunId, "style");
    let designMd = "";
    let styleGuideMd = "";
    try {
      designMd = await fs.readFile(path.join(styleDir, "design.md"), "utf-8");
      styleGuideMd = await fs.readFile(path.join(styleDir, "style-guide.md"), "utf-8");
    } catch {
      console.warn("[Codegen] Design docs not found, using defaults");
      designMd = "Follow the locked token aesthetic.";
      styleGuideMd = "Use tokens for all visual properties.";
    }

    // Parse crop analyses
    const cropAnalyses: CropAnalysis[] = (irData.cropAnalyses || []).map(
      (ca: unknown) => CropAnalysisSchema.parse(ca)
    );

    console.log(`[Codegen] Found ${cropAnalyses.length} crop analyses`);

    // Build prompts
    const systemPrompt = buildCodegenSystemPrompt(lockedTokens, designMd, styleGuideMd);
    const userPrompt = buildCodegenUserPrompt(cropAnalyses, request.components);

    console.log("[Codegen] Calling Claude Opus for code generation...");

    // Call Claude
    let responseText = "";
    for await (const message of query({
      prompt: userPrompt,
      options: {
        systemPrompt,
        allowedTools: [],
        model: CLAUDE_MODEL,
      },
    })) {
      if (message.type === "assistant" && message.message?.content) {
        for (const block of message.message.content) {
          if ("text" in block && typeof block.text === "string") {
            responseText += block.text;
          }
        }
      }
    }

    const claudeLatencyMs = Date.now() - startTime;
    console.log(`[Codegen] Claude response received in ${claudeLatencyMs}ms`);

    // Parse response
    interface GeneratedFilesResponse {
      files: Array<{ path: string; content: string }>;
    }

    let generatedFiles: GeneratedFilesResponse;
    try {
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : responseText.trim();
      generatedFiles = JSON.parse(jsonStr);
    } catch (err) {
      console.error("[Codegen] Failed to parse Claude response");
      res.status(500).json({
        error: "Failed to parse generated code",
        message: String(err),
      });
      return;
    }

    // Create output directory
    const packageDir = path.join(outputDir, `ui-${request.setSlug}`);
    await fs.mkdir(packageDir, { recursive: true });

    // Write files
    const writtenFiles: GeneratedFile[] = [];
    for (const file of generatedFiles.files) {
      const filePath = path.join(packageDir, file.path);
      const fileDir = path.dirname(filePath);
      await fs.mkdir(fileDir, { recursive: true });
      await fs.writeFile(filePath, file.content, "utf-8");

      const hash = createHash("sha256").update(file.content).digest("hex");
      writtenFiles.push({
        plannedPath: file.path,
        actualPath: filePath,
        contentHash: hash,
        sizeBytes: Buffer.byteLength(file.content),
        success: true,
      });

      console.log(`[Codegen] Written: ${file.path}`);
    }

    // Validate tokens
    const validations: ValidationResult[] = [];

    if (!request.skipValidation) {
      // Find tokens.css
      const tokensCssFile = generatedFiles.files.find((f) =>
        f.path.endsWith("tokens.css")
      );

      if (tokensCssFile) {
        const tokenErrors = validateTokensCss(tokensCssFile.content, lockedTokens);
        const tokenWarnings = verifyTokensComplete(tokensCssFile.content, lockedTokens);

        if (tokenErrors.length > 0) {
          validations.push({
            path: tokensCssFile.path,
            type: "lint",
            passed: false,
            errors: tokenErrors,
            warnings: tokenWarnings,
          });

          // Fail the job
          res.status(400).json({
            error: "Token validation failed",
            message: "Generated tokens.css introduces new base tokens",
            errors: tokenErrors,
          });
          return;
        }

        validations.push({
          path: tokensCssFile.path,
          type: "lint",
          passed: true,
          warnings: tokenWarnings,
        });
      }

      // Verify registry paths exist
      const registryFile = generatedFiles.files.find((f) =>
        f.path.endsWith("registry.json")
      );

      if (registryFile) {
        try {
          const registry = JSON.parse(registryFile.content);
          const missingPaths: string[] = [];

          for (const item of registry.items || []) {
            for (const file of item.files || []) {
              const exists = generatedFiles.files.some((f) => f.path === file.path);
              if (!exists) {
                missingPaths.push(file.path);
              }
            }
          }

          if (missingPaths.length > 0) {
            validations.push({
              path: registryFile.path,
              type: "lint",
              passed: false,
              errors: missingPaths.map((p) => `Registry references missing file: ${p}`),
            });

            res.status(400).json({
              error: "Registry validation failed",
              message: "Registry references missing files",
              missingPaths,
            });
            return;
          }

          validations.push({
            path: registryFile.path,
            type: "lint",
            passed: true,
          });
        } catch {
          validations.push({
            path: registryFile.path,
            type: "lint",
            passed: false,
            errors: ["Invalid JSON in registry.json"],
          });
        }
      }
    }

    // Copy design docs
    await fs.writeFile(
      path.join(packageDir, "DESIGN_SYSTEM.md"),
      `# Design System\n\n${designMd}\n\n---\n\n${styleGuideMd}`
    );

    const totalLatencyMs = Date.now() - startTime;

    // Build result
    const result: CodegenResult = {
      id: randomUUID(),
      planId: randomUUID(), // No separate plan in this flow
      files: writtenFiles,
      validations,
      success: true,
      summary: `Generated ${writtenFiles.length} files for ui-${request.setSlug}`,
      completedAt: new Date().toISOString(),
      durationMs: totalLatencyMs,
    };

    console.log(`[Codegen] Complete! ${writtenFiles.length} files in ${totalLatencyMs}ms`);

    const response: CodegenResponse = {
      packagePath: packageDir,
      result,
    };

    res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Codegen] Failed:`, message);

    res.status(500).json({
      error: "Codegen failed",
      message,
      runId: request.runId,
    });
  }
});

// =============================================================================
// V2: Per-Component Generation
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
 * GET /codegen/v2/status/:runId
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
