/**
 * Registry Schemas - Zod schemas for shadcn-compatible registry format.
 *
 * Based on:
 * - https://ui.shadcn.com/schema/registry.json
 * - https://ui.shadcn.com/schema/registry-item.json
 */

import { z } from "zod";

// =============================================================================
// Registry Item Types (from shadcn schema)
// =============================================================================

export const RegistryItemTypeSchema = z.enum([
  "registry:lib",
  "registry:block",
  "registry:component",
  "registry:ui",
  "registry:hook",
  "registry:theme",
  "registry:page",
  "registry:file",
  "registry:style",
  "registry:base",
  "registry:font",
  "registry:item",
]);

export type RegistryItemType = z.infer<typeof RegistryItemTypeSchema>;

// =============================================================================
// Registry Item File
// =============================================================================

export const RegistryFileSchema = z.object({
  /** Path to the file relative to the registry root */
  path: z.string(),
  /** Content of the file (optional in template, filled during generation) */
  content: z.string().optional(),
  /** Type of the file */
  type: RegistryItemTypeSchema,
  /** Target path for registry:file and registry:page types */
  target: z.string().optional(),
});

export type RegistryFile = z.infer<typeof RegistryFileSchema>;

// =============================================================================
// CSS Variables
// =============================================================================

export const CssVarsSchema = z.object({
  /** CSS variables for @theme directive (Tailwind v4) */
  theme: z.record(z.string()).optional(),
  /** CSS variables for light theme */
  light: z.record(z.string()).optional(),
  /** CSS variables for dark theme */
  dark: z.record(z.string()).optional(),
});

export type CssVars = z.infer<typeof CssVarsSchema>;

// =============================================================================
// Font Configuration
// =============================================================================

export const RegistryFontSchema = z.object({
  /** Font family name */
  family: z.string(),
  /** Font provider */
  provider: z.enum(["google"]),
  /** Import name from next/font/google */
  import: z.string(),
  /** CSS variable name */
  variable: z.string(),
  /** Font weights to include */
  weight: z.array(z.string()).optional(),
  /** Font subsets to include */
  subsets: z.array(z.string()).optional(),
});

export type RegistryFont = z.infer<typeof RegistryFontSchema>;

// =============================================================================
// BoxyBop Meta Extension
// =============================================================================

export const ComponentSourceSchema = z.enum([
  "primitive",
  "detected",
  "inferred",
  "template",
]);

export type ComponentSource = z.infer<typeof ComponentSourceSchema>;

export const ComponentCategorySchema = z.enum([
  "foundations",
  "layout",
  "typography",
  "navigation",
  "forms",
  "buttons",
  "data-display",
  "feedback",
  "overlays",
  "media",
  "utility",
  "advanced",
]);

export type ComponentCategory = z.infer<typeof ComponentCategorySchema>;

export const BoxyBopMetaSchema = z.object({
  /** How this component is generated */
  source: ComponentSourceSchema,
  /** Whether this component is required */
  required: z.boolean(),
  /** Primary category */
  category: ComponentCategorySchema,
  /** For inferred components: inference rule details */
  inferredFrom: z
    .object({
      rule: z.enum(["composition", "pattern", "card-structure", "always"]),
      triggers: z.array(z.string()),
    })
    .optional(),
  /** Common variants for this component */
  variants: z.array(z.string()).optional(),
  /** Common states for this component */
  states: z.array(z.string()).optional(),
  /** Token references used by this component */
  tokenRefs: z
    .object({
      colors: z.array(z.string()).optional(),
      typography: z.array(z.string()).optional(),
      spacing: z.array(z.string()).optional(),
      radius: z.array(z.string()).optional(),
      shadows: z.array(z.string()).optional(),
    })
    .optional(),
  /** From crop analysis */
  cropId: z.string().optional(),
  /** Style description for AI generation */
  styleDescription: z.string().optional(),
});

export type BoxyBopMeta = z.infer<typeof BoxyBopMetaSchema>;

// =============================================================================
// Registry Item (shadcn-compatible with BoxyBop extensions)
// =============================================================================

export const RegistryItemSchema = z.object({
  /** Name (kebab-case, unique identifier) */
  name: z.string(),
  /** Type of the item */
  type: RegistryItemTypeSchema,
  /** Human-readable title */
  title: z.string().optional(),
  /** Description */
  description: z.string().optional(),
  /** Author */
  author: z.string().optional(),
  /** NPM dependencies */
  dependencies: z.array(z.string()).optional(),
  /** NPM dev dependencies */
  devDependencies: z.array(z.string()).optional(),
  /** Registry dependencies (other registry items) */
  registryDependencies: z.array(z.string()).optional(),
  /** Files in this item */
  files: z.array(RegistryFileSchema).optional(),
  /** Tailwind configuration */
  tailwind: z
    .object({
      config: z
        .object({
          content: z.array(z.string()).optional(),
          theme: z.record(z.unknown()).optional(),
          plugins: z.array(z.string()).optional(),
        })
        .optional(),
    })
    .optional(),
  /** CSS variables */
  cssVars: CssVarsSchema.optional(),
  /** CSS definitions */
  css: z.record(z.unknown()).optional(),
  /** Environment variables */
  envVars: z.record(z.string()).optional(),
  /** Additional metadata (BoxyBop extensions) */
  meta: BoxyBopMetaSchema.optional(),
  /** Documentation (markdown) */
  docs: z.string().optional(),
  /** Categories for filtering */
  categories: z.array(z.string()).optional(),
  /** Font configuration (for registry:font type) */
  font: RegistryFontSchema.optional(),
});

export type RegistryItem = z.infer<typeof RegistryItemSchema>;

// =============================================================================
// Registry Metadata (BoxyBop extension)
// =============================================================================

export const RegistryMetadataSchema = z.object({
  /** Design set identifier */
  setSlug: z.string(),
  /** Style run ID (links to locked tokens) */
  styleRunId: z.string(),
  /** When the registry was created */
  createdAt: z.string(),
  /** Input checksum for cache validation */
  inputChecksum: z.string(),
  /** BoxyBop version that generated this */
  generatorVersion: z.string().optional(),
});

export type RegistryMetadata = z.infer<typeof RegistryMetadataSchema>;

// =============================================================================
// Full Registry (shadcn-compatible)
// =============================================================================

export const RegistrySchema = z.object({
  /** JSON Schema reference */
  $schema: z.string().optional(),
  /** Registry name */
  name: z.string(),
  /** Homepage URL */
  homepage: z.string(),
  /** Registry items */
  items: z.array(RegistryItemSchema),
  /** BoxyBop metadata (extension) */
  metadata: RegistryMetadataSchema.optional(),
});

export type Registry = z.infer<typeof RegistrySchema>;

// =============================================================================
// Generation State (separate from registry)
// =============================================================================

export const GenerationStatusSchema = z.enum([
  "pending",
  "in_progress",
  "complete",
  "failed",
  "skipped",
]);

export type GenerationStatus = z.infer<typeof GenerationStatusSchema>;

export const ComponentGenerationStateSchema = z.object({
  /** Current status */
  status: GenerationStatusSchema,
  /** When generation started */
  startedAt: z.string().optional(),
  /** When generation completed */
  completedAt: z.string().optional(),
  /** Output path if generated */
  outputPath: z.string().optional(),
  /** Error message if failed */
  error: z.string().optional(),
  /** Number of retry attempts */
  retries: z.number().default(0),
});

export type ComponentGenerationState = z.infer<typeof ComponentGenerationStateSchema>;

export const GenerationStateSchema = z.object({
  /** State schema version */
  version: z.literal("1.0.0"),
  /** Unique run ID */
  runId: z.string(),
  /** Design set identifier */
  setSlug: z.string(),
  /** Style run ID */
  styleRunId: z.string(),
  /** Input checksum for cache validation */
  inputChecksum: z.string(),
  /** When generation started */
  createdAt: z.string(),
  /** Last update time */
  updatedAt: z.string(),
  /** Per-component state */
  components: z.record(z.string(), ComponentGenerationStateSchema),
  /** Summary counts */
  summary: z.object({
    total: z.number(),
    pending: z.number(),
    inProgress: z.number(),
    complete: z.number(),
    failed: z.number(),
    skipped: z.number(),
  }),
});

export type GenerationState = z.infer<typeof GenerationStateSchema>;

// =============================================================================
// Template Placeholders
// =============================================================================

export const TEMPLATE_PLACEHOLDERS = {
  SET_SLUG: "{{SET_SLUG}}",
  STYLE_RUN_ID: "{{STYLE_RUN_ID}}",
  CREATED_AT: "{{CREATED_AT}}",
  INPUT_CHECKSUM: "{{INPUT_CHECKSUM}}",
  HOMEPAGE: "{{HOMEPAGE}}",
  GENERATOR_VERSION: "{{GENERATOR_VERSION}}",
} as const;

export type TemplatePlaceholder = keyof typeof TEMPLATE_PLACEHOLDERS;

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validate a registry against the schema.
 */
export function validateRegistry(data: unknown): Registry {
  return RegistrySchema.parse(data);
}

/**
 * Validate a registry item against the schema.
 */
export function validateRegistryItem(data: unknown): RegistryItem {
  return RegistryItemSchema.parse(data);
}

/**
 * Validate generation state against the schema.
 */
export function validateGenerationState(data: unknown): GenerationState {
  return GenerationStateSchema.parse(data);
}

/**
 * Safe parse a registry (returns success/error).
 */
export function safeParseRegistry(data: unknown) {
  return RegistrySchema.safeParse(data);
}

/**
 * Safe parse generation state (returns success/error).
 */
export function safeParseGenerationState(data: unknown) {
  return GenerationStateSchema.safeParse(data);
}
