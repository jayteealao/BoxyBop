/**
 * Registry Processor.
 *
 * Manages the master registry for a UI package:
 * - Initializes registry from template
 * - Merges detected components from crop analysis
 * - Tracks generation state separately
 * - Validates completeness
 *
 * IMPORTANT: This module is the ONLY code allowed to write registry.json.
 * AI agents (Claude, Gemini) must NEVER modify the registry directly.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { randomUUID } from "node:crypto";
import type { CropAnalysis, StyleGuideLocked } from "@boxybop/ir";
import {
  generateRequiredTemplate,
  fillTemplatePlaceholders,
  addOptionalComponents,
  updateItemWithCropAnalysis,
  getComponent,
  type Registry,
  type RegistryItem,
  type GenerationState,
  type ComponentGenerationState,
  ALL_COMPONENTS,
} from "@boxybop/registry";

// =============================================================================
// Types
// =============================================================================

export interface RegistryInitConfig {
  /** Output directory for the UI package */
  outputDir: string;
  /** Design set slug */
  setSlug: string;
  /** Style run ID (links to locked tokens) */
  styleRunId: string;
  /** Locked tokens for checksum */
  lockedTokens: StyleGuideLocked;
  /** Crop analyses from detection */
  cropAnalyses: CropAnalysis[];
  /** Optional categories to include (e.g., ["media", "advanced"]) */
  includeOptional?: string[];
  /** Homepage URL override */
  homepage?: string;
}

export interface RegistryValidationResult {
  /** Whether all required components are complete */
  complete: boolean;
  /** Components that are missing or incomplete */
  missing: string[];
  /** Components that failed generation */
  failed: string[];
  /** Components that are complete */
  completed: string[];
  /** Progress percentage */
  progress: number;
}

// =============================================================================
// Registry Initialization
// =============================================================================

/**
 * Compute input checksum for cache invalidation.
 */
function computeInputChecksum(
  lockedTokens: StyleGuideLocked,
  cropAnalyses: CropAnalysis[]
): string {
  const inputData = {
    tokensHash: lockedTokens.tokensHash,
    crops: cropAnalyses.map((c) => ({
      id: c.cropId,
      hash: c.cropHash,
      name: c.suggestedComponentName,
    })),
  };
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(inputData))
    .digest("hex")
    .slice(0, 16);
}

/**
 * Initialize a new registry for a UI package.
 *
 * This creates:
 * - registry.json (shadcn-compatible, read-only after creation)
 * - .codegen/state.json (generation progress tracking)
 */
export async function initializeRegistry(
  config: RegistryInitConfig
): Promise<{ registry: Registry; state: GenerationState }> {
  const inputChecksum = computeInputChecksum(config.lockedTokens, config.cropAnalyses);
  const createdAt = new Date().toISOString();

  // Generate base registry from template
  let registry = generateRequiredTemplate();

  // Fill placeholders
  registry = fillTemplatePlaceholders(registry, {
    setSlug: config.setSlug,
    styleRunId: config.styleRunId,
    createdAt,
    inputChecksum,
    homepage: config.homepage,
    generatorVersion: "1.0.0",
  });

  // Add optional categories if requested
  if (config.includeOptional && config.includeOptional.length > 0) {
    registry = addOptionalComponents(registry, config.includeOptional);
  }

  // Update items with crop analysis data
  for (const crop of config.cropAnalyses) {
    if (!crop.suggestedComponentName) continue;

    const componentName = kebabCase(crop.suggestedComponentName);
    const itemIndex = registry.items.findIndex((item) => item.name === componentName);

    if (itemIndex >= 0) {
      // Update existing item with crop data
      registry.items[itemIndex] = updateItemWithCropAnalysis(registry.items[itemIndex], {
        cropId: crop.cropId,
        styleDescription: crop.styleDescription,
        tokenRefs: {
          colors: crop.colorTokensUsed.map((t) => t.cssVar),
          typography: crop.typographyTokensUsed.map((t) => t.cssVar),
          spacing: crop.spacingTokensUsed.map((t) => t.cssVar),
          radius: crop.radiusTokensUsed.map((t) => t.cssVar),
          shadows: crop.shadowTokensUsed.map((t) => t.cssVar),
        },
        variants: crop.variants,
        states: crop.states,
      });
    }
    // Note: We don't add new items for unrecognized components
    // The registry is the source of truth; detected components must match
  }

  // Initialize generation state
  const state = initializeGenerationState(registry, config.setSlug, config.styleRunId, inputChecksum);

  return { registry, state };
}

/**
 * Convert PascalCase or Title Case to kebab-case.
 */
function kebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

/**
 * Initialize generation state from registry.
 */
function initializeGenerationState(
  registry: Registry,
  setSlug: string,
  styleRunId: string,
  inputChecksum: string
): GenerationState {
  const now = new Date().toISOString();
  const components: Record<string, ComponentGenerationState> = {};

  for (const item of registry.items) {
    components[item.name] = {
      status: "pending",
      retries: 0,
    };
  }

  const total = registry.items.length;

  return {
    version: "1.0.0",
    runId: randomUUID(),
    setSlug,
    styleRunId,
    inputChecksum,
    createdAt: now,
    updatedAt: now,
    components,
    summary: {
      total,
      pending: total,
      inProgress: 0,
      complete: 0,
      failed: 0,
      skipped: 0,
    },
  };
}

// =============================================================================
// Registry Persistence
// =============================================================================

/**
 * Get the registry file path.
 */
export function getRegistryPath(outputDir: string): string {
  return path.join(outputDir, "registry.json");
}

/**
 * Get the state file path.
 */
export function getStatePath(outputDir: string): string {
  return path.join(outputDir, ".codegen", "state.json");
}

/**
 * Save registry to disk.
 *
 * NOTE: Registry should only be written once during initialization.
 * After that, it should be treated as read-only.
 */
export async function saveRegistry(outputDir: string, registry: Registry): Promise<void> {
  const registryPath = getRegistryPath(outputDir);
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(registryPath, JSON.stringify(registry, null, 2));
}

/**
 * Load registry from disk.
 */
export async function loadRegistry(outputDir: string): Promise<Registry | null> {
  const registryPath = getRegistryPath(outputDir);

  try {
    const content = await fs.readFile(registryPath, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

/**
 * Save generation state to disk.
 */
export async function saveGenerationState(outputDir: string, state: GenerationState): Promise<void> {
  const statePath = getStatePath(outputDir);
  const stateDir = path.dirname(statePath);

  await fs.mkdir(stateDir, { recursive: true });

  // Update timestamp and recalculate summary
  state.updatedAt = new Date().toISOString();
  state.summary = calculateSummary(state.components);

  await fs.writeFile(statePath, JSON.stringify(state, null, 2));
}

/**
 * Load generation state from disk.
 */
export async function loadGenerationState(outputDir: string): Promise<GenerationState | null> {
  const statePath = getStatePath(outputDir);

  try {
    const content = await fs.readFile(statePath, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

/**
 * Calculate summary from component states.
 */
function calculateSummary(
  components: Record<string, ComponentGenerationState>
): GenerationState["summary"] {
  const values = Object.values(components);
  return {
    total: values.length,
    pending: values.filter((c) => c.status === "pending").length,
    inProgress: values.filter((c) => c.status === "in_progress").length,
    complete: values.filter((c) => c.status === "complete").length,
    failed: values.filter((c) => c.status === "failed").length,
    skipped: values.filter((c) => c.status === "skipped").length,
  };
}

// =============================================================================
// State Management
// =============================================================================

/**
 * Get the next component to generate.
 */
export function getNextComponent(
  registry: Registry,
  state: GenerationState
): RegistryItem | null {
  // Get generation order based on dependencies
  const order = getGenerationOrderFromRegistry(registry);

  for (const item of order) {
    const componentState = state.components[item.name];
    if (componentState?.status === "pending") {
      // Check if all dependencies are complete
      const deps = item.registryDependencies || [];
      const allDepsComplete = deps.every(
        (dep) => state.components[dep]?.status === "complete"
      );

      if (allDepsComplete) {
        return item;
      }
    }
  }

  return null;
}

/**
 * Get generation order respecting dependencies.
 */
function getGenerationOrderFromRegistry(registry: Registry): RegistryItem[] {
  const result: RegistryItem[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const itemMap = new Map(registry.items.map((item) => [item.name, item]));

  function visit(name: string) {
    if (visited.has(name)) return;
    if (visiting.has(name)) {
      // Circular dependency - skip
      return;
    }

    const item = itemMap.get(name);
    if (!item) return;

    visiting.add(name);

    for (const dep of item.registryDependencies || []) {
      visit(dep);
    }

    visiting.delete(name);
    visited.add(name);
    result.push(item);
  }

  for (const item of registry.items) {
    visit(item.name);
  }

  return result;
}

/**
 * Mark a component as in-progress.
 */
export function markInProgress(state: GenerationState, componentName: string): void {
  if (state.components[componentName]) {
    state.components[componentName].status = "in_progress";
    state.components[componentName].startedAt = new Date().toISOString();
  }
}

/**
 * Mark a component as complete.
 */
export function markComplete(
  state: GenerationState,
  componentName: string,
  outputPath?: string
): void {
  if (state.components[componentName]) {
    state.components[componentName].status = "complete";
    state.components[componentName].completedAt = new Date().toISOString();
    if (outputPath) {
      state.components[componentName].outputPath = outputPath;
    }
  }
}

/**
 * Mark a component as failed.
 */
export function markFailed(
  state: GenerationState,
  componentName: string,
  error: string
): void {
  if (state.components[componentName]) {
    state.components[componentName].status = "failed";
    state.components[componentName].error = error;
    state.components[componentName].retries =
      (state.components[componentName].retries || 0) + 1;
  }
}

/**
 * Mark a component as skipped.
 */
export function markSkipped(state: GenerationState, componentName: string): void {
  if (state.components[componentName]) {
    state.components[componentName].status = "skipped";
  }
}

/**
 * Reset failed components to pending for retry.
 */
export function resetFailedToPending(state: GenerationState): number {
  let resetCount = 0;

  for (const [name, component] of Object.entries(state.components)) {
    if (component.status === "failed") {
      state.components[name].status = "pending";
      delete state.components[name].error;
      resetCount += 1;
    }
  }

  return resetCount;
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate registry completeness.
 */
export function validateCompleteness(
  registry: Registry,
  state: GenerationState
): RegistryValidationResult {
  const missing: string[] = [];
  const failed: string[] = [];
  const completed: string[] = [];

  for (const item of registry.items) {
    const componentState = state.components[item.name];

    // Check if required
    const isRequired = item.meta?.required ?? true;

    if (!componentState) {
      if (isRequired) missing.push(item.name);
    } else if (componentState.status === "complete") {
      completed.push(item.name);
    } else if (componentState.status === "failed") {
      failed.push(item.name);
    } else if (isRequired && componentState.status === "pending") {
      missing.push(item.name);
    }
  }

  const total = registry.items.filter((i) => i.meta?.required ?? true).length;
  const progress = total > 0 ? Math.round((completed.length / total) * 100) : 0;

  return {
    complete: missing.length === 0 && failed.length === 0,
    missing,
    failed,
    completed,
    progress,
  };
}

/**
 * Verify that generated files exist on disk.
 */
export async function verifyFilesExist(
  outputDir: string,
  registry: Registry,
  state: GenerationState
): Promise<{ missing: string[]; verified: string[] }> {
  const missing: string[] = [];
  const verified: string[] = [];

  for (const item of registry.items) {
    const componentState = state.components[item.name];

    if (componentState?.status === "complete" && item.files) {
      for (const file of item.files) {
        const filePath = path.join(outputDir, file.path);
        try {
          await fs.access(filePath);
          verified.push(filePath);
        } catch {
          missing.push(filePath);
        }
      }
    }
  }

  return { missing, verified };
}

// =============================================================================
// Registry Queries
// =============================================================================

/**
 * Get a registry item by name.
 */
export function getRegistryItem(registry: Registry, name: string): RegistryItem | undefined {
  return registry.items.find((item) => item.name === name);
}

/**
 * Get registry items by category.
 */
export function getRegistryItemsByCategory(
  registry: Registry,
  category: string
): RegistryItem[] {
  return registry.items.filter(
    (item) =>
      item.meta?.category === category || item.categories?.includes(category)
  );
}

/**
 * Get registry items by source type.
 */
export function getRegistryItemsBySource(
  registry: Registry,
  source: "primitive" | "detected" | "inferred" | "template"
): RegistryItem[] {
  return registry.items.filter((item) => item.meta?.source === source);
}

/**
 * Get all dependencies for a component (recursive).
 */
export function getAllDependencies(registry: Registry, name: string): string[] {
  const deps = new Set<string>();
  const queue = [name];
  const itemMap = new Map(registry.items.map((item) => [item.name, item]));

  while (queue.length > 0) {
    const current = queue.shift()!;
    const item = itemMap.get(current);
    if (!item) continue;

    for (const dep of item.registryDependencies || []) {
      if (!deps.has(dep)) {
        deps.add(dep);
        queue.push(dep);
      }
    }
  }

  return Array.from(deps);
}
