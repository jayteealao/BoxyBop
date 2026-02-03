/**
 * Per-Component Generator.
 *
 * Generates one component at a time using Claude Opus with:
 * - Full source images for design grounding
 * - Locked tokens (immutable)
 * - Minimal, focused context per component
 * - Deterministic output (temperature=0)
 *
 * The generator uses the master registry as the source of truth for what
 * components need to be generated. It tracks progress in state.json.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { CropAnalysis, StyleGuideLocked } from "@boxybop/ir";
import type { InferredComponent, CodegenState, ComponentGenerationContext } from "./types.js";
import {
  PRIMITIVE_TEMPLATES,
  UTILITY_TEMPLATES,
  generateUtilsFile,
  generateIndexFile,
} from "./templates.js";
import {
  loadState,
  saveState,
  initializeState,
  computeInputChecksum,
  isStateValid,
  getNextComponent,
  markInProgress,
  markComplete,
  markFailed,
  getProgressSummary,
  getCompletedComponents,
  resetFailedToPending,
} from "./state.js";
import { inferComponents } from "./inference.js";
import {
  initializeRegistry,
  loadRegistry,
  saveRegistry,
  loadGenerationState,
  saveGenerationState,
} from "./registry.js";
import type { Registry, GenerationState as RegistryGenerationState } from "@boxybop/registry";

/**
 * Configuration for the generator.
 */
export interface GeneratorConfig {
  /** Output directory for the UI package */
  outputDir: string;
  /** Set slug for naming */
  setSlug: string;
  /** Style run ID */
  styleRunId: string;
  /** Locked tokens */
  lockedTokens: StyleGuideLocked;
  /** Crop analyses from detection */
  cropAnalyses: CropAnalysis[];
  /** Full source images (base64 PNG) */
  sourceImages: Array<{
    name: string;
    base64: string;
    width: number;
    height: number;
  }>;
  /** Crop images (base64 PNG) keyed by cropId */
  cropImages: Record<string, string>;
  /** Path to tokens.css */
  tokensCssPath: string;
  /** Path to DESIGN_SYSTEM.md */
  designSystemMdPath: string;
  /** Anthropic API key */
  anthropicApiKey: string;
  /** Whether to retry failed components */
  retryFailed?: boolean;
  /** Maximum components to generate (for testing) */
  maxComponents?: number;
}

/**
 * Result of running the generator.
 */
export interface GeneratorResult {
  success: boolean;
  outputDir: string;
  state: CodegenState;
  progress: ReturnType<typeof getProgressSummary>;
  errors: Array<{ name: string; error: string }>;
}

/**
 * Build the system prompt for component generation.
 */
function buildSystemPrompt(config: GeneratorConfig): string {
  return `You are an expert React component developer generating production-quality TypeScript components.

## CRITICAL CONSTRAINTS

1. **LOCKED TOKENS ARE IMMUTABLE**
   - You MUST use ONLY the provided CSS custom properties (tokens)
   - You MUST NOT introduce any new tokens, colors, sizes, or spacing values
   - Every color, spacing, radius, shadow, and typography value MUST use a provided token
   - If a design requires a value not in the tokens, use the closest available token

2. **OUTPUT FORMAT**
   - Generate valid TypeScript/TSX code
   - Use React.forwardRef for all components
   - Include proper TypeScript types for all props
   - Use "cn" utility for className merging (already provided)
   - No external dependencies beyond React and provided utilities

3. **CODE STYLE**
   - Clean, readable code with clear prop interfaces
   - Use template literals for CSS custom properties: \`var(--token-name)\`
   - Inline styles using React.CSSProperties when appropriate
   - JSDoc comments for component and significant props

4. **DESIGN GROUNDING**
   - You have access to the full source images showing the design
   - Use these to understand visual hierarchy, spacing relationships, and aesthetics
   - Match the visual style as closely as possible using available tokens

## TOKEN REFERENCE

The following CSS custom properties are available. Use ONLY these:

### Colors
${config.lockedTokens.tokens.colors.map((c) => `- ${c.cssVar}: ${c.value} (${c.role || "general"})`).join("\n")}

### Typography
${config.lockedTokens.tokens.typography.map((t) => `- ${t.cssVar}: ${t.fontSize} / ${t.fontWeight}`).join("\n")}

### Spacing
${config.lockedTokens.tokens.spacing.map((s) => `- ${s.cssVar}: ${s.value}`).join("\n")}

### Radius
${config.lockedTokens.tokens.radius.map((r) => `- ${r.cssVar}: ${r.value}`).join("\n")}

### Shadows
${config.lockedTokens.tokens.shadows.map((s) => `- ${s.cssVar}: ${s.value}`).join("\n")}

When I ask you to generate a component, respond with ONLY the code. No explanations.
Format: Start with the component file content, then a separator "---STORY---", then the Storybook story.`;
}

/**
 * Build a prompt for a detected component (has crop).
 */
function buildDetectedComponentPrompt(
  crop: CropAnalysis,
  cropBase64: string | undefined,
  completedComponents: string[]
): string {
  let prompt = `Generate the "${crop.suggestedComponentName}" component.

## Component Details
- **Name**: ${crop.suggestedComponentName}
- **Category**: ${crop.category}
- **Description**: ${crop.description}

## Style Description (from design analysis)
${crop.styleDescription || "No detailed style description available."}

## Detected Elements
${crop.elements.map((e) => `- ${e.type}: ${e.description}`).join("\n")}

## Token Usage (detected from design)
- Colors: ${crop.colorTokensUsed.map((t) => t.cssVar).join(", ") || "none"}
- Typography: ${crop.typographyTokensUsed.map((t) => t.cssVar).join(", ") || "none"}
- Spacing: ${crop.spacingTokensUsed.map((t) => t.cssVar).join(", ") || "none"}
- Radius: ${crop.radiusTokensUsed.map((t) => t.cssVar).join(", ") || "none"}
- Shadows: ${crop.shadowTokensUsed.map((t) => t.cssVar).join(", ") || "none"}

## States
${crop.states.length > 0 ? crop.states.join(", ") : "default only"}

## Variants
${crop.variants.length > 0 ? crop.variants.join(", ") : "none"}

## Observations
- Alignment: ${crop.observations.alignment}
- Density: ${crop.observations.density}
- Has interactive indicators: ${crop.observations.hasInteractiveIndicators}
${crop.observations.notes ? `- Notes: ${crop.observations.notes}` : ""}
`;

  if (completedComponents.length > 0) {
    prompt += `\n## Available Components (can import)
${completedComponents.map((c) => `- ${c}`).join("\n")}
`;
  }

  if (cropBase64) {
    prompt += `\n## Crop Image
The cropped UI element is provided as an image attachment.
`;
  }

  prompt += `\nGenerate the component with proper TypeScript types, React.forwardRef, and a Storybook story.`;

  return prompt;
}

/**
 * Build a prompt for an inferred component (no crop).
 */
function buildInferredComponentPrompt(
  inferred: InferredComponent,
  completedComponents: string[]
): string {
  let prompt = `Generate the "${inferred.name}" component.

## Component Details
- **Name**: ${inferred.name}
- **Category**: ${inferred.category}
- **Description**: ${inferred.description}
- **Inferred from**: ${inferred.inferredFrom.sourceComponents.join(", ")} (${inferred.inferredFrom.rule} rule)
- **Confidence**: ${Math.round(inferred.inferredFrom.confidence * 100)}%

## Style Description
${inferred.styleDescription}

## Token References
${inferred.tokenRefs.length > 0 ? inferred.tokenRefs.join(", ") : "Use tokens from source components"}
`;

  if (completedComponents.length > 0) {
    prompt += `\n## Available Components (can import and compose)
${completedComponents.map((c) => `- ${c}`).join("\n")}

This component should compose or extend the source components listed above.
`;
  }

  prompt += `\nGenerate the component with proper TypeScript types, React.forwardRef, and a Storybook story.`;

  return prompt;
}

/**
 * Generate tokens.css file from locked tokens.
 */
async function generateTokensCss(
  outputDir: string,
  lockedTokens: StyleGuideLocked
): Promise<string> {
  const lines: string[] = [
    "/* Auto-generated design tokens - DO NOT EDIT */",
    "/* Source: locked_tokens.json */",
    `/* Hash: ${lockedTokens.tokensHash} */`,
    "",
    ":root {",
  ];

  // Colors
  lines.push("  /* Colors */");
  for (const c of lockedTokens.tokens.colors) {
    lines.push(`  ${c.cssVar}: ${c.value};`);
  }
  lines.push("");

  // Typography
  lines.push("  /* Typography */");
  for (const t of lockedTokens.tokens.typography) {
    lines.push(`  ${t.cssVar}: ${t.fontSize};`);
    lines.push(`  ${t.cssVar}-weight: ${t.fontWeight};`);
    if (t.lineHeight) {
      lines.push(`  ${t.cssVar}-line-height: ${t.lineHeight};`);
    }
  }
  lines.push("");

  // Spacing
  lines.push("  /* Spacing */");
  for (const s of lockedTokens.tokens.spacing) {
    lines.push(`  ${s.cssVar}: ${s.value};`);
  }
  lines.push("");

  // Radius
  lines.push("  /* Radius */");
  for (const r of lockedTokens.tokens.radius) {
    lines.push(`  ${r.cssVar}: ${r.value};`);
  }
  lines.push("");

  // Shadows
  lines.push("  /* Shadows */");
  for (const s of lockedTokens.tokens.shadows) {
    lines.push(`  ${s.cssVar}: ${s.value};`);
  }

  lines.push("}");

  const content = lines.join("\n");
  const tokensPath = path.join(outputDir, "tokens.css");
  await fs.writeFile(tokensPath, content);

  return tokensPath;
}

/**
 * Generate primitive components from templates.
 */
async function generatePrimitives(
  outputDir: string,
  lockedTokens: StyleGuideLocked
): Promise<void> {
  const componentsDir = path.join(outputDir, "components");
  await fs.mkdir(componentsDir, { recursive: true });

  // Generate utils.ts
  const utilsPath = path.join(outputDir, "lib", "utils.ts");
  await fs.mkdir(path.dirname(utilsPath), { recursive: true });
  await fs.writeFile(utilsPath, generateUtilsFile());

  // Generate each primitive
  for (const [name, template] of Object.entries(PRIMITIVE_TEMPLATES)) {
    const componentDir = path.join(componentsDir, name);
    await fs.mkdir(componentDir, { recursive: true });

    // Component file
    const source = template.generateSource(lockedTokens);
    await fs.writeFile(path.join(componentDir, `${name}.tsx`), source);

    // Story file
    const story = template.generateStory(lockedTokens);
    await fs.writeFile(path.join(componentDir, `${name}.stories.tsx`), story);

    // Index file
    await fs.writeFile(
      path.join(componentDir, "index.ts"),
      `export * from "./${name}";\n`
    );
  }
}

/**
 * Generate utility components from templates.
 */
async function generateUtilities(
  outputDir: string,
  lockedTokens: StyleGuideLocked
): Promise<void> {
  const componentsDir = path.join(outputDir, "components");

  for (const [name, template] of Object.entries(UTILITY_TEMPLATES)) {
    const componentDir = path.join(componentsDir, name);
    await fs.mkdir(componentDir, { recursive: true });

    // Component file
    const source = template.generateSource(lockedTokens);
    await fs.writeFile(path.join(componentDir, `${name}.tsx`), source);

    // Story file
    const story = template.generateStory(lockedTokens);
    await fs.writeFile(path.join(componentDir, `${name}.stories.tsx`), story);

    // Index file
    await fs.writeFile(
      path.join(componentDir, "index.ts"),
      `export * from "./${name}";\n`
    );
  }
}

/**
 * Generate a component using Claude.
 */
async function generateComponentWithClaude(
  prompt: string,
  systemPrompt: string,
  sourceImages: Array<{ name: string; base64: string }>,
  cropImage: { base64: string } | null,
  anthropicApiKey: string
): Promise<{ componentCode: string; storyCode: string }> {
  // Build messages with images
  const contentParts: Array<
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: "image/png"; data: string } }
  > = [];

  // Add source images for grounding
  for (const img of sourceImages) {
    contentParts.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: img.base64,
      },
    });
    contentParts.push({
      type: "text",
      text: `[Source image: ${img.name}]`,
    });
  }

  // Add crop image if available
  if (cropImage) {
    contentParts.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: cropImage.base64,
      },
    });
    contentParts.push({
      type: "text",
      text: "[Crop image for this component]",
    });
  }

  // Add the prompt
  contentParts.push({
    type: "text",
    text: prompt,
  });

  // Call Claude API directly (Claude Agent SDK is for agentic workflows)
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-20250514",
      max_tokens: 8192,
      temperature: 0, // Deterministic
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: contentParts,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json() as {
    content: Array<{ type: string; text?: string }>;
  };

  const text = result.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("");

  // Parse the response
  const parts = text.split("---STORY---");
  const componentCode = parts[0]?.trim() || "";
  const storyCode = parts[1]?.trim() || "";

  // Extract code from markdown code blocks if present
  const extractCode = (code: string): string => {
    const match = code.match(/```(?:tsx?|typescript)?\n([\s\S]*?)```/);
    return match ? match[1].trim() : code;
  };

  return {
    componentCode: extractCode(componentCode),
    storyCode: extractCode(storyCode),
  };
}

/**
 * Write a generated component to disk.
 */
async function writeComponent(
  outputDir: string,
  name: string,
  componentCode: string,
  storyCode: string
): Promise<string> {
  const componentDir = path.join(outputDir, "components", name);
  await fs.mkdir(componentDir, { recursive: true });

  // Component file
  await fs.writeFile(path.join(componentDir, `${name}.tsx`), componentCode);

  // Story file
  if (storyCode) {
    await fs.writeFile(path.join(componentDir, `${name}.stories.tsx`), storyCode);
  }

  // Index file
  await fs.writeFile(
    path.join(componentDir, "index.ts"),
    `export * from "./${name}";\n`
  );

  return componentDir;
}

/**
 * Generate the registry.json file.
 */
async function generateRegistry(
  outputDir: string,
  completedComponents: string[]
): Promise<string> {
  const registry = {
    $schema: "https://ui.shadcn.com/schema/registry.json",
    name: path.basename(outputDir),
    components: completedComponents.map((name) => ({
      name,
      type: "component",
      files: [`components/${name}/${name}.tsx`],
      dependencies: [],
    })),
  };

  const registryPath = path.join(outputDir, "registry.json");
  await fs.writeFile(registryPath, JSON.stringify(registry, null, 2));

  return registryPath;
}

/**
 * Main generator function.
 */
export async function runGenerator(config: GeneratorConfig): Promise<GeneratorResult> {
  const errors: Array<{ name: string; error: string }> = [];

  console.log(`[Codegen] Starting generation for ${config.setSlug}`);
  console.log(`[Codegen] Output: ${config.outputDir}`);

  // Ensure output directory exists
  await fs.mkdir(config.outputDir, { recursive: true });

  // ==========================================================================
  // Step 1: Initialize master registry (copied from template)
  // ==========================================================================

  let registry = await loadRegistry(config.outputDir);
  let registryState: RegistryGenerationState | null = null;

  if (!registry) {
    console.log(`[Codegen] Initializing master registry from template...`);

    // Initialize registry from template with all 100+ required components
    const initialized = await initializeRegistry({
      outputDir: config.outputDir,
      setSlug: config.setSlug,
      styleRunId: config.styleRunId,
      lockedTokens: config.lockedTokens,
      cropAnalyses: config.cropAnalyses,
      // Don't include optional categories by default
      includeOptional: [],
    });

    registry = initialized.registry;
    registryState = initialized.state;

    // Save registry immediately (it's now read-only)
    await saveRegistry(config.outputDir, registry);
    await saveGenerationState(config.outputDir, registryState);

    console.log(`[Codegen] Registry initialized with ${registry.items.length} components`);
  } else {
    console.log(`[Codegen] Using existing registry (${registry.items.length} components)`);
    registryState = await loadGenerationState(config.outputDir);
  }

  // ==========================================================================
  // Step 2: Initialize legacy state tracking (for backward compatibility)
  // ==========================================================================

  // Compute input checksum
  const inputChecksum = computeInputChecksum(config.lockedTokens, config.cropAnalyses);
  console.log(`[Codegen] Input checksum: ${inputChecksum}`);

  // Load or initialize state
  let state = await loadState(config.outputDir);

  if (state && isStateValid(state, inputChecksum, config.styleRunId)) {
    console.log(`[Codegen] Resuming from existing state (run: ${state.runId})`);

    if (config.retryFailed) {
      const resetCount = resetFailedToPending(state);
      if (resetCount > 0) {
        console.log(`[Codegen] Reset ${resetCount} failed components to pending`);
      }
    }
  } else {
    if (state) {
      console.log("[Codegen] State invalidated (inputs changed), starting fresh");
    }

    // Infer components
    const inferredComponents = inferComponents(config.cropAnalyses, config.lockedTokens);
    console.log(`[Codegen] Inferred ${inferredComponents.length} additional components`);

    state = initializeState(
      config.setSlug,
      config.styleRunId,
      inputChecksum,
      config.cropAnalyses,
      inferredComponents
    );
  }

  await saveState(config.outputDir, state);

  // Build system prompt (shared across all component generations)
  const systemPrompt = buildSystemPrompt(config);

  // Build inferred components map for lookups
  const inferredMap = new Map<string, InferredComponent>();
  const inferredComponents = inferComponents(config.cropAnalyses, config.lockedTokens);
  for (const comp of inferredComponents) {
    inferredMap.set(comp.name, comp);
  }

  // Generation loop
  let generatedCount = 0;
  const maxComponents = config.maxComponents ?? Infinity;

  while (generatedCount < maxComponents) {
    const next = getNextComponent(state);
    if (!next) {
      console.log("[Codegen] All components complete!");
      break;
    }

    console.log(`[Codegen] Generating: ${next.name} (${next.type})`);
    markInProgress(state, next.name, next.type);
    await saveState(config.outputDir, state);

    try {
      switch (next.type) {
        case "tokens": {
          const tokensPath = await generateTokensCss(config.outputDir, config.lockedTokens);
          markComplete(state, next.name, next.type, tokensPath);
          console.log(`[Codegen] Generated tokens.css`);
          break;
        }

        case "primitive": {
          await generatePrimitives(config.outputDir, config.lockedTokens);
          markComplete(state, next.name, next.type);
          console.log(`[Codegen] Generated all primitives`);
          break;
        }

        case "detected": {
          const crop = config.cropAnalyses.find(
            (c) => c.suggestedComponentName === next.name
          );
          if (!crop) {
            throw new Error(`Crop not found for ${next.name}`);
          }

          const completedComponents = getCompletedComponents(state);
          const prompt = buildDetectedComponentPrompt(
            crop,
            config.cropImages[crop.cropId],
            completedComponents
          );

          const cropImage = config.cropImages[crop.cropId]
            ? { base64: config.cropImages[crop.cropId] }
            : null;

          const { componentCode, storyCode } = await generateComponentWithClaude(
            prompt,
            systemPrompt,
            config.sourceImages,
            cropImage,
            config.anthropicApiKey
          );

          const outputPath = await writeComponent(
            config.outputDir,
            next.name,
            componentCode,
            storyCode
          );

          markComplete(state, next.name, next.type, outputPath);
          console.log(`[Codegen] Generated ${next.name}`);
          break;
        }

        case "inferred": {
          const inferred = inferredMap.get(next.name);
          if (!inferred) {
            throw new Error(`Inferred component not found: ${next.name}`);
          }

          const completedComponents = getCompletedComponents(state);
          const prompt = buildInferredComponentPrompt(inferred, completedComponents);

          const { componentCode, storyCode } = await generateComponentWithClaude(
            prompt,
            systemPrompt,
            config.sourceImages,
            null, // No crop for inferred
            config.anthropicApiKey
          );

          const outputPath = await writeComponent(
            config.outputDir,
            next.name,
            componentCode,
            storyCode
          );

          markComplete(state, next.name, next.type, outputPath);
          console.log(`[Codegen] Generated ${next.name} (inferred)`);
          break;
        }

        case "utility": {
          await generateUtilities(config.outputDir, config.lockedTokens);
          // Mark all utilities complete
          for (const name of Object.keys(state.phases.utilities)) {
            markComplete(state, name, "utility");
          }
          console.log(`[Codegen] Generated all utilities`);
          break;
        }

        case "registry": {
          const completedComponents = getCompletedComponents(state);
          const registryPath = await generateRegistry(config.outputDir, completedComponents);

          // Also generate barrel export
          const indexContent = generateIndexFile(completedComponents);
          await fs.writeFile(path.join(config.outputDir, "components", "index.ts"), indexContent);

          markComplete(state, next.name, next.type, registryPath);
          console.log(`[Codegen] Generated registry.json`);
          break;
        }
      }

      generatedCount += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[Codegen] Failed to generate ${next.name}:`, message);
      markFailed(state, next.name, next.type, message);
      errors.push({ name: next.name, error: message });
    }

    await saveState(config.outputDir, state);
  }

  const progress = getProgressSummary(state);
  console.log(
    `[Codegen] Complete: ${progress.complete}/${progress.total} ` +
      `(${progress.failed} failed, ${progress.pending} pending)`
  );

  return {
    success: progress.failed === 0 && progress.pending === 0,
    outputDir: config.outputDir,
    state,
    progress,
    errors,
  };
}
