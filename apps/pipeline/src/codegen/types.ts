/**
 * Codegen types and schemas.
 */

import { z } from "zod";

// =============================================================================
// Component Classification
// =============================================================================

export type ComponentType = "primitive" | "detected" | "inferred" | "utility";

export interface InferredComponent {
  name: string;
  category: string;
  inferredFrom: {
    rule: "composition" | "pattern" | "always" | "card-structure";
    sourceComponents: string[];
    confidence: number;
  };
  description: string;
  styleDescription: string;
  tokenRefs: string[];
}

// =============================================================================
// Generation State
// =============================================================================

export const ComponentStatusSchema = z.enum([
  "pending",
  "in_progress",
  "complete",
  "failed",
  "skipped",
]);

export type ComponentStatus = z.infer<typeof ComponentStatusSchema>;

export const ComponentStateSchema = z.object({
  status: ComponentStatusSchema,
  cropId: z.string().optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  outputPath: z.string().optional(),
  error: z.string().optional(),
});

export type ComponentState = z.infer<typeof ComponentStateSchema>;

export const CodegenStateSchema = z.object({
  version: z.literal("1.0.0"),
  runId: z.string(),
  setSlug: z.string(),
  styleRunId: z.string(),
  inputChecksum: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  phases: z.object({
    tokens: z.object({
      status: ComponentStatusSchema,
      startedAt: z.string().optional(),
      completedAt: z.string().optional(),
      outputPath: z.string().optional(),
      error: z.string().optional(),
    }),
    primitives: z.object({
      status: ComponentStatusSchema,
      components: z.array(z.string()),
      startedAt: z.string().optional(),
      completedAt: z.string().optional(),
      error: z.string().optional(),
    }),
    detected: z.record(z.string(), ComponentStateSchema),
    inferred: z.record(z.string(), ComponentStateSchema),
    utilities: z.record(z.string(), ComponentStateSchema),
    registry: z.object({
      status: ComponentStatusSchema,
      startedAt: z.string().optional(),
      completedAt: z.string().optional(),
      outputPath: z.string().optional(),
      error: z.string().optional(),
    }),
  }),
});

export type CodegenState = z.infer<typeof CodegenStateSchema>;

// =============================================================================
// Generation Context
// =============================================================================

export interface SourceImage {
  id: string;
  base64: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  dimensions: { width: number; height: number };
}

export interface ComponentGenerationContext {
  componentName: string;
  componentType: ComponentType;

  // All source images for design grounding
  sourceImages: SourceImage[];

  // Component-specific crop (only for detected)
  cropImage?: {
    base64: string;
    mimeType: string;
    dimensions: { width: number; height: number };
  };

  // Tokens and style
  lockedTokensCss: string;
  lockedTokensJson: string;
  styleGuideMd: string;
  designMd: string;

  // Component-specific analysis
  cropAnalysis?: {
    description: string;
    styleDescription?: string;
    category: string;
    colorTokensUsed: string[];
    typographyTokensUsed: string[];
    spacingTokensUsed: string[];
    radiusTokensUsed: string[];
    shadowTokensUsed: string[];
    states: string[];
    variants: string[];
  };

  // For inferred components
  inferredFrom?: InferredComponent["inferredFrom"];
  sourceComponentsCode?: Record<string, string>;

  // Generated tokens.css for reference
  generatedTokensCss?: string;
}

// =============================================================================
// Primitives
// =============================================================================

export const PRIMITIVE_COMPONENTS = [
  "Box",
  "Stack",
  "Flex",
  "Grid",
  "Text",
  "Heading",
  "Divider",
] as const;

export type PrimitiveComponent = (typeof PRIMITIVE_COMPONENTS)[number];

// =============================================================================
// Utilities
// =============================================================================

export const UTILITY_COMPONENTS = [
  "VisuallyHidden",
  "Portal",
] as const;

export type UtilityComponent = (typeof UTILITY_COMPONENTS)[number];
