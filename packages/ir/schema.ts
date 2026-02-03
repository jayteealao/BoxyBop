/**
 * BoxyBop Intermediate Representation (IR) Schema
 *
 * This module defines the canonical data structures used throughout the
 * UI screenshot → tokens + components pipeline.
 *
 * CRITICAL INVARIANT: All geometry (x, y, width, height) is in ORIGINAL pixel coordinates.
 * Display coordinates are used only in UI layers and must be converted before storage.
 */

import { z } from "zod";

// =============================================================================
// Primitives
// =============================================================================

/** SHA-256 hash represented as hex string */
export const Sha256HashSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/, "Must be a valid SHA-256 hex string");

/** UUID v4 identifier */
export const UuidSchema = z.string().uuid();

/** Timestamp in ISO 8601 format */
export const TimestampSchema = z.string().datetime();

/** Semantic version string */
export const SemverSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, "Must be valid semver (e.g., 1.0.0)");

/** Non-negative integer for pixel coordinates */
export const PixelCoordSchema = z.number().int().nonnegative();

/** Positive integer for dimensions */
export const PixelDimensionSchema = z.number().int().positive();

/** Confidence score between 0 and 1 */
export const ConfidenceSchema = z.number().min(0).max(1);

/** CSS color value (hex, rgb, rgba, hsl, hsla) */
export const CssColorSchema = z.string().min(1);

/** CSS size value (px, rem, em, %) */
export const CssSizeSchema = z.string().min(1);

// =============================================================================
// Geometry (always in ORIGINAL pixel coordinates)
// =============================================================================

/**
 * Bounding box in original pixel coordinates.
 * Origin is top-left corner of the image.
 */
export const BBoxSchema = z.object({
  /** X coordinate of top-left corner in original pixels */
  x: PixelCoordSchema,
  /** Y coordinate of top-left corner in original pixels */
  y: PixelCoordSchema,
  /** Width in original pixels */
  width: PixelDimensionSchema,
  /** Height in original pixels */
  height: PixelDimensionSchema,
});

export type BBox = z.infer<typeof BBoxSchema>;

/**
 * Image dimensions in pixels.
 */
export const DimensionsSchema = z.object({
  width: PixelDimensionSchema,
  height: PixelDimensionSchema,
});

export type Dimensions = z.infer<typeof DimensionsSchema>;

// =============================================================================
// ImageSet
// =============================================================================

/**
 * Represents a single image in the set.
 */
export const ImageEntrySchema = z.object({
  /** Unique identifier for this image */
  id: UuidSchema,
  /** Original filename */
  filename: z.string().min(1),
  /** Path to stored image file */
  storagePath: z.string().min(1),
  /** MIME type (image/png, image/jpeg, etc.) */
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  /** Dimensions in original pixels */
  dimensions: DimensionsSchema,
  /** SHA-256 hash of file contents */
  contentHash: Sha256HashSchema,
  /** When the image was ingested */
  ingestedAt: TimestampSchema,
});

export type ImageEntry = z.infer<typeof ImageEntrySchema>;

/**
 * Collection of images being processed in a session.
 */
export const ImageSetSchema = z.object({
  /** Unique identifier for this image set */
  id: UuidSchema,
  /** Human-readable name for the session */
  name: z.string().min(1).optional(),
  /** Images in this set */
  images: z.array(ImageEntrySchema).min(1),
  /** When the set was created */
  createdAt: TimestampSchema,
});

export type ImageSet = z.infer<typeof ImageSetSchema>;

// =============================================================================
// ParsedElement (from OmniParser)
// =============================================================================

/** UI element types recognized by the parser */
export const ElementTypeSchema = z.enum([
  "button",
  "input",
  "text",
  "image",
  "icon",
  "card",
  "container",
  "navigation",
  "header",
  "footer",
  "list",
  "list-item",
  "checkbox",
  "radio",
  "toggle",
  "slider",
  "dropdown",
  "modal",
  "tooltip",
  "badge",
  "avatar",
  "divider",
  "unknown",
]);

export type ElementType = z.infer<typeof ElementTypeSchema>;

/**
 * A UI element detected by OmniParser.
 */
export const ParsedElementSchema = z.object({
  /** Unique identifier */
  id: UuidSchema,
  /** Source of this element (always "omniparser" for now) */
  source: z.literal("omniparser"),
  /** ID of the image this element was found in */
  imageId: UuidSchema,
  /** Bounding box in ORIGINAL pixel coordinates */
  bbox: BBoxSchema,
  /** Detected element type/label */
  elementType: ElementTypeSchema,
  /** Raw label from OmniParser */
  rawLabel: z.string().optional(),
  /** Detection confidence (0-1) */
  confidence: ConfidenceSchema,
  /** Index in the parser's output order */
  parserIndex: z.number().int().nonnegative(),
  /** Raw parser output for debugging */
  rawParserOutput: z.record(z.unknown()).optional(),
});

export type ParsedElement = z.infer<typeof ParsedElementSchema>;

// =============================================================================
// CropSpec (human-adjusted crop region)
// =============================================================================

/**
 * Specifies a region to crop from an image.
 * Coordinates are ALWAYS in original pixel space.
 */
export const CropSpecSchema = z.object({
  /** Unique identifier */
  id: UuidSchema,
  /** ID of the source image */
  imageId: UuidSchema,
  /** ID of the ParsedElement this was derived from (if any) */
  sourceElementId: UuidSchema.optional(),
  /** Crop region in ORIGINAL pixel coordinates */
  region: BBoxSchema,
  /** Human-provided label for this crop */
  label: z.string().optional(),
  /** Whether this crop was human-adjusted */
  humanAdjusted: z.boolean(),
  /** When this spec was created/modified */
  updatedAt: TimestampSchema,
});

export type CropSpec = z.infer<typeof CropSpecSchema>;

// =============================================================================
// CropArtifact (actual cropped PNG)
// =============================================================================

/**
 * A cropped image file ready for analysis.
 */
export const CropArtifactSchema = z.object({
  /** Unique identifier */
  id: UuidSchema,
  /** ID of the CropSpec this was created from */
  cropSpecId: UuidSchema,
  /** ID of the source image */
  sourceImageId: UuidSchema,
  /** Path to the cropped PNG file */
  storagePath: z.string().min(1),
  /** SHA-256 hash of the PNG file */
  contentHash: Sha256HashSchema,
  /** Dimensions of the cropped image */
  dimensions: DimensionsSchema,
  /** File size in bytes */
  fileSizeBytes: z.number().int().positive(),
  /** When this artifact was created */
  createdAt: TimestampSchema,
});

export type CropArtifact = z.infer<typeof CropArtifactSchema>;

// =============================================================================
// GeminiAnalysis
// =============================================================================

/**
 * Color extraction from Gemini analysis.
 */
export const ExtractedColorSchema = z.object({
  /** Role/purpose of this color */
  role: z.enum([
    "background",
    "foreground",
    "primary",
    "secondary",
    "accent",
    "border",
    "shadow",
    "text",
    "text-muted",
    "success",
    "warning",
    "error",
    "info",
  ]),
  /** Color value (hex preferred) */
  value: CssColorSchema,
  /** Confidence in this extraction */
  confidence: ConfidenceSchema,
});

export type ExtractedColor = z.infer<typeof ExtractedColorSchema>;

/**
 * Typography extraction from Gemini analysis.
 */
export const ExtractedTypographySchema = z.object({
  /** Text role */
  role: z.enum([
    "heading-1",
    "heading-2",
    "heading-3",
    "heading-4",
    "body",
    "body-small",
    "caption",
    "label",
    "button",
    "code",
  ]),
  /** Approximate font size */
  fontSize: CssSizeSchema.optional(),
  /** Font weight (100-900 or keywords) */
  fontWeight: z.union([z.number().int().min(100).max(900), z.string()]).optional(),
  /** Line height */
  lineHeight: z.union([z.number(), z.string()]).optional(),
  /** Letter spacing */
  letterSpacing: CssSizeSchema.optional(),
});

export type ExtractedTypography = z.infer<typeof ExtractedTypographySchema>;

/**
 * Spacing value extraction.
 */
export const ExtractedSpacingSchema = z.object({
  /** Context where spacing was observed */
  context: z.enum(["padding", "margin", "gap", "inset"]),
  /** Estimated value */
  value: CssSizeSchema,
});

export type ExtractedSpacing = z.infer<typeof ExtractedSpacingSchema>;

/**
 * Component suggestion from Gemini.
 */
export const ComponentSuggestionSchema = z.object({
  /** Suggested component name */
  name: z.string().min(1),
  /** Component category */
  category: z.enum([
    "layout",
    "navigation",
    "form",
    "feedback",
    "data-display",
    "overlay",
    "typography",
    "media",
  ]),
  /** Detected props */
  props: z.array(
    z.object({
      name: z.string().min(1),
      type: z.string().min(1),
      required: z.boolean(),
      defaultValue: z.unknown().optional(),
    })
  ),
  /** Detected variants */
  variants: z.array(z.string()).optional(),
  /** Detected states */
  states: z.array(z.enum(["default", "hover", "active", "focus", "disabled", "loading"])).optional(),
});

export type ComponentSuggestion = z.infer<typeof ComponentSuggestionSchema>;

/**
 * Structured output from Gemini analysis of a cropped image.
 */
export const GeminiAnalysisSchema = z.object({
  /** Unique identifier */
  id: UuidSchema,
  /** ID of the CropArtifact that was analyzed */
  cropArtifactId: UuidSchema,
  /** Gemini model used */
  model: z.string().min(1),
  /** Version of the prompt used */
  promptVersion: SemverSchema,
  /** When the analysis was performed */
  analyzedAt: TimestampSchema,
  /** Latency in milliseconds */
  latencyMs: z.number().int().nonnegative(),
  /** Extracted colors */
  colors: z.array(ExtractedColorSchema),
  /** Extracted typography */
  typography: z.array(ExtractedTypographySchema),
  /** Extracted spacing values */
  spacing: z.array(ExtractedSpacingSchema),
  /** Border radius values detected */
  borderRadius: z.array(CssSizeSchema),
  /** Box shadow values detected */
  boxShadows: z.array(z.string()),
  /** Component suggestions */
  componentSuggestions: z.array(ComponentSuggestionSchema),
  /** Free-form description of the UI element */
  description: z.string().optional(),
  /** Raw Gemini response for debugging */
  rawResponse: z.record(z.unknown()).optional(),
});

export type GeminiAnalysis = z.infer<typeof GeminiAnalysisSchema>;

// =============================================================================
// ComponentCandidate
// =============================================================================

/**
 * Generation tier determines when a component is generated.
 * - tier-0-token: Design tokens (colors, spacing, etc.) - always generated
 * - tier-1-primitive: Layout primitives (Box, Stack, etc.) - always generated
 * - tier-2-detected: Components detected from screenshots - conditional
 * - tier-3-utility: Infrastructure utilities - always generated
 * - tier-2c-domain: Domain-specific components - not auto-generated
 */
export const GenerationTierSchema = z.enum([
  "tier-0-token",
  "tier-1-primitive",
  "tier-2-detected",
  "tier-3-utility",
  "tier-2c-domain",
]);

export type GenerationTier = z.infer<typeof GenerationTierSchema>;

/**
 * A candidate component derived from analysis.
 */
export const ComponentCandidateSchema = z.object({
  /** Unique identifier */
  id: UuidSchema,
  /** Deduplication key (hash of normalized props/variants) */
  dedupKey: z.string().min(1),
  /** Proposed component name (PascalCase) */
  name: z.string().regex(/^[A-Z][a-zA-Z0-9]*$/, "Must be PascalCase"),
  /** Component category */
  category: z.enum([
    "layout",
    "navigation",
    "form",
    "feedback",
    "data-display",
    "overlay",
    "typography",
    "media",
  ]),
  /** Generation tier - determines if/when this component is generated */
  generationTier: GenerationTierSchema,
  /** Source analysis IDs this was derived from (empty for primitives/utilities) */
  sourceAnalysisIds: z.array(UuidSchema),
  /** Proposed props */
  props: z.array(
    z.object({
      name: z.string().min(1),
      type: z.string().min(1),
      required: z.boolean(),
      description: z.string().optional(),
      defaultValue: z.unknown().optional(),
    })
  ),
  /** Proposed variants */
  variants: z.array(
    z.object({
      name: z.string().min(1),
      values: z.array(z.string().min(1)),
      defaultValue: z.string().optional(),
    })
  ),
  /** Supported states */
  states: z.array(z.enum(["default", "hover", "active", "focus", "disabled", "loading"])),
  /** Token references this component should use */
  tokenRefs: z.array(z.string()),
  /** When this candidate was created */
  createdAt: TimestampSchema,
});

export type ComponentCandidate = z.infer<typeof ComponentCandidateSchema>;

// =============================================================================
// TokenCandidate
// =============================================================================

/**
 * Color token candidate.
 */
export const ColorTokenSchema = z.object({
  /** Token name (e.g., "color-primary-500") */
  name: z.string().min(1),
  /** Color value */
  value: CssColorSchema,
  /** Semantic role */
  role: ExtractedColorSchema.shape.role.optional(),
  /** Source analysis IDs */
  sourceAnalysisIds: z.array(UuidSchema),
});

export type ColorToken = z.infer<typeof ColorTokenSchema>;

/**
 * Type scale token candidate.
 */
export const TypeScaleTokenSchema = z.object({
  /** Token name (e.g., "text-lg") */
  name: z.string().min(1),
  /** Font size value */
  fontSize: CssSizeSchema,
  /** Line height */
  lineHeight: z.union([z.number(), z.string()]).optional(),
  /** Font weight */
  fontWeight: z.union([z.number().int(), z.string()]).optional(),
  /** Letter spacing */
  letterSpacing: CssSizeSchema.optional(),
  /** Source analysis IDs */
  sourceAnalysisIds: z.array(UuidSchema),
});

export type TypeScaleToken = z.infer<typeof TypeScaleTokenSchema>;

/**
 * Spacing scale token candidate.
 */
export const SpacingTokenSchema = z.object({
  /** Token name (e.g., "space-4") */
  name: z.string().min(1),
  /** Spacing value */
  value: CssSizeSchema,
  /** Source analysis IDs */
  sourceAnalysisIds: z.array(UuidSchema),
});

export type SpacingToken = z.infer<typeof SpacingTokenSchema>;

/**
 * Border radius token candidate.
 */
export const RadiusTokenSchema = z.object({
  /** Token name (e.g., "radius-md") */
  name: z.string().min(1),
  /** Radius value */
  value: CssSizeSchema,
  /** Source analysis IDs */
  sourceAnalysisIds: z.array(UuidSchema),
});

export type RadiusToken = z.infer<typeof RadiusTokenSchema>;

/**
 * Shadow token candidate.
 */
export const ShadowTokenSchema = z.object({
  /** Token name (e.g., "shadow-lg") */
  name: z.string().min(1),
  /** CSS box-shadow value */
  value: z.string().min(1),
  /** Source analysis IDs */
  sourceAnalysisIds: z.array(UuidSchema),
});

export type ShadowToken = z.infer<typeof ShadowTokenSchema>;

/**
 * All token candidates extracted from analysis.
 */
export const TokenCandidateSchema = z.object({
  /** Unique identifier */
  id: UuidSchema,
  /** Color tokens */
  colors: z.array(ColorTokenSchema),
  /** Type scale tokens */
  typeScale: z.array(TypeScaleTokenSchema),
  /** Spacing tokens */
  spacing: z.array(SpacingTokenSchema),
  /** Border radius tokens */
  radius: z.array(RadiusTokenSchema),
  /** Shadow tokens */
  shadows: z.array(ShadowTokenSchema),
  /** When these tokens were extracted */
  createdAt: TimestampSchema,
});

export type TokenCandidate = z.infer<typeof TokenCandidateSchema>;

// =============================================================================
// CodegenPlan
// =============================================================================

/**
 * A file to be generated.
 */
export const PlannedFileSchema = z.object({
  /** Relative output path */
  path: z.string().min(1),
  /** Type of file */
  type: z.enum([
    "token-css",
    "token-ts",
    "primitive",
    "utility",
    "component",
    "story",
    "registry",
    "index",
  ]),
  /** Generation tier this file belongs to */
  generationTier: GenerationTierSchema,
  /** What this file will contain */
  description: z.string().min(1),
  /** IDs of source candidates (empty for primitives/utilities) */
  sourceIds: z.array(UuidSchema),
});

export type PlannedFile = z.infer<typeof PlannedFileSchema>;

/**
 * Plan for code generation.
 */
export const CodegenPlanSchema = z.object({
  /** Unique identifier */
  id: UuidSchema,
  /** Token candidate ID */
  tokenCandidateId: UuidSchema.optional(),
  /** Component candidate IDs */
  componentCandidateIds: z.array(UuidSchema),
  /** Files to generate */
  files: z.array(PlannedFileSchema),
  /** Output root directory */
  outputRoot: z.string().min(1),
  /** When this plan was created */
  createdAt: TimestampSchema,
});

export type CodegenPlan = z.infer<typeof CodegenPlanSchema>;

// =============================================================================
// CodegenResult
// =============================================================================

/**
 * Result of generating a single file.
 */
export const GeneratedFileSchema = z.object({
  /** Planned path */
  plannedPath: z.string().min(1),
  /** Actual path written (may differ if conflicts) */
  actualPath: z.string().min(1),
  /** SHA-256 hash of file contents */
  contentHash: Sha256HashSchema,
  /** File size in bytes */
  sizeBytes: z.number().int().nonnegative(),
  /** Whether generation succeeded */
  success: z.boolean(),
  /** Error message if failed */
  error: z.string().optional(),
});

export type GeneratedFile = z.infer<typeof GeneratedFileSchema>;

/**
 * Lint/test result for a generated file.
 */
export const ValidationResultSchema = z.object({
  /** File path */
  path: z.string().min(1),
  /** Type of validation */
  type: z.enum(["lint", "typecheck", "test"]),
  /** Whether validation passed */
  passed: z.boolean(),
  /** Errors if failed */
  errors: z.array(z.string()).optional(),
  /** Warnings */
  warnings: z.array(z.string()).optional(),
});

export type ValidationResult = z.infer<typeof ValidationResultSchema>;

/**
 * Result of code generation.
 */
export const CodegenResultSchema = z.object({
  /** Unique identifier */
  id: UuidSchema,
  /** ID of the plan that was executed */
  planId: UuidSchema,
  /** Generated files */
  files: z.array(GeneratedFileSchema),
  /** Validation results */
  validations: z.array(ValidationResultSchema),
  /** Overall success */
  success: z.boolean(),
  /** Summary message */
  summary: z.string(),
  /** When generation completed */
  completedAt: TimestampSchema,
  /** Total duration in milliseconds */
  durationMs: z.number().int().nonnegative(),
});

export type CodegenResult = z.infer<typeof CodegenResultSchema>;

// =============================================================================
// Session (top-level container)
// =============================================================================

/**
 * Complete pipeline session containing all IR nodes.
 */
export const PipelineSessionSchema = z.object({
  /** Session identifier */
  id: UuidSchema,
  /** Human-readable name */
  name: z.string().optional(),
  /** When the session started */
  startedAt: TimestampSchema,
  /** When the session completed (if finished) */
  completedAt: TimestampSchema.optional(),
  /** Image set being processed */
  imageSet: ImageSetSchema,
  /** Elements detected by OmniParser */
  parsedElements: z.array(ParsedElementSchema),
  /** Human-adjusted crop specifications */
  cropSpecs: z.array(CropSpecSchema),
  /** Generated crop artifacts */
  cropArtifacts: z.array(CropArtifactSchema),
  /** Gemini analysis results */
  analyses: z.array(GeminiAnalysisSchema),
  /** Extracted token candidates */
  tokenCandidates: TokenCandidateSchema.optional(),
  /** Derived component candidates */
  componentCandidates: z.array(ComponentCandidateSchema),
  /** Code generation plan */
  codegenPlan: CodegenPlanSchema.optional(),
  /** Code generation result */
  codegenResult: CodegenResultSchema.optional(),
});

export type PipelineSession = z.infer<typeof PipelineSessionSchema>;

// =============================================================================
// Exports
// =============================================================================

export const schemas = {
  // Primitives
  Sha256HashSchema,
  UuidSchema,
  TimestampSchema,
  SemverSchema,
  PixelCoordSchema,
  PixelDimensionSchema,
  ConfidenceSchema,
  CssColorSchema,
  CssSizeSchema,
  // Geometry
  BBoxSchema,
  DimensionsSchema,
  // Core types
  ImageEntrySchema,
  ImageSetSchema,
  ParsedElementSchema,
  CropSpecSchema,
  CropArtifactSchema,
  GeminiAnalysisSchema,
  ComponentCandidateSchema,
  TokenCandidateSchema,
  CodegenPlanSchema,
  CodegenResultSchema,
  PipelineSessionSchema,
  // Sub-types
  ElementTypeSchema,
  GenerationTierSchema,
  ExtractedColorSchema,
  ExtractedTypographySchema,
  ExtractedSpacingSchema,
  ComponentSuggestionSchema,
  ColorTokenSchema,
  TypeScaleTokenSchema,
  SpacingTokenSchema,
  RadiusTokenSchema,
  ShadowTokenSchema,
  PlannedFileSchema,
  GeneratedFileSchema,
  ValidationResultSchema,
};
