/**
 * @boxybop/registry - Master component registry for BoxyBop UI packages.
 *
 * This package provides:
 * - Component manifest (all 120+ components)
 * - Zod schemas for registry validation
 * - Template generation for new UI packages
 */

// Component manifest
export {
  ALL_COMPONENTS,
  REQUIRED_COMPONENTS,
  OPTIONAL_COMPONENTS,
  CATEGORIES,
  COMPONENT_COUNTS,
  getComponent,
  getComponentsByCategory,
  getComponentsBySource,
  getDependents,
  getAllDependencies,
  getGenerationOrder,
  type ComponentDefinition,
  type CategoryDefinition,
  type ComponentCategory,
  type ComponentSource,
} from "./components.js";

// Schemas
export {
  RegistrySchema,
  RegistryItemSchema,
  RegistryFileSchema,
  RegistryMetadataSchema,
  GenerationStateSchema,
  ComponentGenerationStateSchema,
  GenerationStatusSchema,
  ComponentSourceSchema,
  ComponentCategorySchema,
  BoxyBopMetaSchema,
  CssVarsSchema,
  RegistryFontSchema,
  RegistryItemTypeSchema,
  TEMPLATE_PLACEHOLDERS,
  validateRegistry,
  validateRegistryItem,
  validateGenerationState,
  safeParseRegistry,
  safeParseGenerationState,
  type Registry,
  type RegistryItem,
  type RegistryFile,
  type RegistryMetadata,
  type GenerationState,
  type ComponentGenerationState,
  type GenerationStatus,
  type BoxyBopMeta,
  type CssVars,
  type RegistryFont,
  type RegistryItemType,
  type TemplatePlaceholder,
} from "./schema.js";

// Template generation
export {
  generateMasterTemplate,
  generateRequiredTemplate,
  fillTemplatePlaceholders,
  addOptionalComponents,
  updateItemWithCropAnalysis,
  getMasterTemplateJson,
  getTemplateSummary,
} from "./template.js";
