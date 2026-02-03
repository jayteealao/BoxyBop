/**
 * Codegen Module.
 *
 * Per-component generation with state tracking, inference, and templates.
 */

export * from "./types.js";
export * from "./inference.js";
export * from "./templates.js";
export * from "./state.js";
export * from "./generator.js";

// Registry exports - namespaced to avoid conflicts with state.js
export {
  initializeRegistry,
  loadRegistry,
  saveRegistry,
  loadGenerationState as loadRegistryState,
  saveGenerationState as saveRegistryState,
  getRegistryPath,
  getStatePath as getRegistryStatePath,
  validateCompleteness,
  verifyFilesExist,
  getRegistryItem,
  getRegistryItemsByCategory,
  getRegistryItemsBySource,
  getAllDependencies as getRegistryDependencies,
  type RegistryInitConfig,
  type RegistryValidationResult,
} from "./registry.js";

// Storybook exports
export {
  setupStorybook,
  generatePackageJson,
  generateTsConfig,
  generateStorybookMain,
  generateStorybookPreview,
  generateTestRunnerConfig,
  generateSnapshotCompareScript,
} from "./storybook.js";
