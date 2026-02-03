/**
 * Codegen State Management.
 *
 * Tracks generation progress, enables resume/retry, and maintains
 * checksums for cache invalidation. State is persisted to disk in
 * the .codegen/ folder within the output package.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { randomUUID } from "node:crypto";
import type { CropAnalysis, StyleGuideLocked } from "@boxybop/ir";
import {
  type CodegenState,
  type ComponentState,
  CodegenStateSchema,
  PRIMITIVE_COMPONENTS,
  UTILITY_COMPONENTS,
} from "./types.js";
import { inferComponents, getGenerationOrder } from "./inference.js";
import type { InferredComponent } from "./types.js";

/**
 * Compute checksum of inputs for cache invalidation.
 */
export function computeInputChecksum(
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
 * Get the state file path.
 */
function getStatePath(outputDir: string): string {
  return path.join(outputDir, ".codegen", "state.json");
}

/**
 * Load existing state from disk, if any.
 */
export async function loadState(outputDir: string): Promise<CodegenState | null> {
  const statePath = getStatePath(outputDir);

  try {
    const content = await fs.readFile(statePath, "utf-8");
    const parsed = JSON.parse(content);
    const validation = CodegenStateSchema.safeParse(parsed);

    if (!validation.success) {
      console.warn("[State] Invalid state file, ignoring:", validation.error.message);
      return null;
    }

    return validation.data;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

/**
 * Save state to disk.
 */
export async function saveState(outputDir: string, state: CodegenState): Promise<void> {
  const statePath = getStatePath(outputDir);
  const stateDir = path.dirname(statePath);

  // Ensure .codegen directory exists
  await fs.mkdir(stateDir, { recursive: true });

  // Update timestamp
  state.updatedAt = new Date().toISOString();

  // Validate before saving
  const validation = CodegenStateSchema.safeParse(state);
  if (!validation.success) {
    throw new Error(`Invalid state: ${validation.error.message}`);
  }

  await fs.writeFile(statePath, JSON.stringify(state, null, 2));
}

/**
 * Initialize a new state object.
 */
export function initializeState(
  setSlug: string,
  styleRunId: string,
  inputChecksum: string,
  detectedComponents: CropAnalysis[],
  inferredComponents: InferredComponent[]
): CodegenState {
  const now = new Date().toISOString();

  // Build detected phase
  const detected: Record<string, ComponentState> = {};
  for (const crop of detectedComponents) {
    const name = crop.suggestedComponentName;
    if (name) {
      detected[name] = {
        status: "pending",
        cropId: crop.cropId,
      };
    }
  }

  // Build inferred phase
  const inferred: Record<string, ComponentState> = {};
  for (const comp of inferredComponents) {
    inferred[comp.name] = {
      status: "pending",
    };
  }

  // Build utilities phase
  const utilities: Record<string, ComponentState> = {};
  for (const name of UTILITY_COMPONENTS) {
    utilities[name] = {
      status: "pending",
    };
  }

  return {
    version: "1.0.0",
    runId: randomUUID(),
    setSlug,
    styleRunId,
    inputChecksum,
    createdAt: now,
    updatedAt: now,
    phases: {
      tokens: {
        status: "pending",
      },
      primitives: {
        status: "pending",
        components: [...PRIMITIVE_COMPONENTS],
      },
      detected,
      inferred,
      utilities,
      registry: {
        status: "pending",
      },
    },
  };
}

/**
 * Check if state is valid for current inputs (no cache invalidation needed).
 */
export function isStateValid(
  state: CodegenState,
  inputChecksum: string,
  styleRunId: string
): boolean {
  return (
    state.inputChecksum === inputChecksum &&
    state.styleRunId === styleRunId
  );
}

/**
 * Get the next component to generate.
 * Returns null if all components are complete.
 */
export function getNextComponent(
  state: CodegenState
): { name: string; type: "tokens" | "primitive" | "detected" | "inferred" | "utility" | "registry" } | null {
  // Phase 1: Tokens
  if (state.phases.tokens.status === "pending") {
    return { name: "tokens", type: "tokens" };
  }

  // Phase 2: Primitives
  if (state.phases.primitives.status === "pending") {
    return { name: "primitives", type: "primitive" };
  }

  // Phase 3: Detected components (in alphabetical order)
  const detectedNames = Object.keys(state.phases.detected).sort();
  for (const name of detectedNames) {
    if (state.phases.detected[name].status === "pending") {
      return { name, type: "detected" };
    }
  }

  // Phase 4: Inferred components (in dependency order)
  const inferredNames = Object.keys(state.phases.inferred).sort();
  for (const name of inferredNames) {
    if (state.phases.inferred[name].status === "pending") {
      return { name, type: "inferred" };
    }
  }

  // Phase 5: Utilities
  for (const name of UTILITY_COMPONENTS) {
    if (state.phases.utilities[name]?.status === "pending") {
      return { name, type: "utility" };
    }
  }

  // Phase 6: Registry
  if (state.phases.registry.status === "pending") {
    return { name: "registry", type: "registry" };
  }

  return null;
}

/**
 * Mark a component as in-progress.
 */
export function markInProgress(
  state: CodegenState,
  name: string,
  type: "tokens" | "primitive" | "detected" | "inferred" | "utility" | "registry"
): void {
  switch (type) {
    case "tokens":
      state.phases.tokens.status = "in_progress";
      state.phases.tokens.startedAt = new Date().toISOString();
      break;
    case "primitive":
      state.phases.primitives.status = "in_progress";
      state.phases.primitives.startedAt = new Date().toISOString();
      break;
    case "detected":
      if (state.phases.detected[name]) {
        state.phases.detected[name].status = "in_progress";
        state.phases.detected[name].startedAt = new Date().toISOString();
      }
      break;
    case "inferred":
      if (state.phases.inferred[name]) {
        state.phases.inferred[name].status = "in_progress";
        state.phases.inferred[name].startedAt = new Date().toISOString();
      }
      break;
    case "utility":
      if (state.phases.utilities[name]) {
        state.phases.utilities[name].status = "in_progress";
        state.phases.utilities[name].startedAt = new Date().toISOString();
      }
      break;
    case "registry":
      state.phases.registry.status = "in_progress";
      state.phases.registry.startedAt = new Date().toISOString();
      break;
  }
}

/**
 * Mark a component as complete.
 */
export function markComplete(
  state: CodegenState,
  name: string,
  type: "tokens" | "primitive" | "detected" | "inferred" | "utility" | "registry",
  outputPath?: string
): void {
  const now = new Date().toISOString();

  switch (type) {
    case "tokens":
      state.phases.tokens.status = "complete";
      state.phases.tokens.completedAt = now;
      if (outputPath) state.phases.tokens.outputPath = outputPath;
      break;
    case "primitive":
      state.phases.primitives.status = "complete";
      state.phases.primitives.completedAt = now;
      break;
    case "detected":
      if (state.phases.detected[name]) {
        state.phases.detected[name].status = "complete";
        state.phases.detected[name].completedAt = now;
        if (outputPath) state.phases.detected[name].outputPath = outputPath;
      }
      break;
    case "inferred":
      if (state.phases.inferred[name]) {
        state.phases.inferred[name].status = "complete";
        state.phases.inferred[name].completedAt = now;
        if (outputPath) state.phases.inferred[name].outputPath = outputPath;
      }
      break;
    case "utility":
      if (state.phases.utilities[name]) {
        state.phases.utilities[name].status = "complete";
        state.phases.utilities[name].completedAt = now;
        if (outputPath) state.phases.utilities[name].outputPath = outputPath;
      }
      break;
    case "registry":
      state.phases.registry.status = "complete";
      state.phases.registry.completedAt = now;
      if (outputPath) state.phases.registry.outputPath = outputPath;
      break;
  }
}

/**
 * Mark a component as failed.
 */
export function markFailed(
  state: CodegenState,
  name: string,
  type: "tokens" | "primitive" | "detected" | "inferred" | "utility" | "registry",
  error: string
): void {
  switch (type) {
    case "tokens":
      state.phases.tokens.status = "failed";
      state.phases.tokens.error = error;
      break;
    case "primitive":
      state.phases.primitives.status = "failed";
      state.phases.primitives.error = error;
      break;
    case "detected":
      if (state.phases.detected[name]) {
        state.phases.detected[name].status = "failed";
        state.phases.detected[name].error = error;
      }
      break;
    case "inferred":
      if (state.phases.inferred[name]) {
        state.phases.inferred[name].status = "failed";
        state.phases.inferred[name].error = error;
      }
      break;
    case "utility":
      if (state.phases.utilities[name]) {
        state.phases.utilities[name].status = "failed";
        state.phases.utilities[name].error = error;
      }
      break;
    case "registry":
      state.phases.registry.status = "failed";
      state.phases.registry.error = error;
      break;
  }
}

/**
 * Get generation progress summary.
 */
export function getProgressSummary(state: CodegenState): {
  total: number;
  complete: number;
  failed: number;
  pending: number;
  phases: Record<string, { complete: number; total: number }>;
} {
  let total = 0;
  let complete = 0;
  let failed = 0;

  const phases: Record<string, { complete: number; total: number }> = {};

  // Tokens (1 item)
  total += 1;
  if (state.phases.tokens.status === "complete") complete += 1;
  if (state.phases.tokens.status === "failed") failed += 1;
  phases.tokens = {
    complete: state.phases.tokens.status === "complete" ? 1 : 0,
    total: 1,
  };

  // Primitives (count as 1 batch)
  total += 1;
  if (state.phases.primitives.status === "complete") complete += 1;
  if (state.phases.primitives.status === "failed") failed += 1;
  phases.primitives = {
    complete: state.phases.primitives.status === "complete" ? 1 : 0,
    total: 1,
  };

  // Detected
  const detectedTotal = Object.keys(state.phases.detected).length;
  let detectedComplete = 0;
  let detectedFailed = 0;
  for (const comp of Object.values(state.phases.detected)) {
    if (comp.status === "complete") detectedComplete += 1;
    if (comp.status === "failed") detectedFailed += 1;
  }
  total += detectedTotal;
  complete += detectedComplete;
  failed += detectedFailed;
  phases.detected = { complete: detectedComplete, total: detectedTotal };

  // Inferred
  const inferredTotal = Object.keys(state.phases.inferred).length;
  let inferredComplete = 0;
  let inferredFailed = 0;
  for (const comp of Object.values(state.phases.inferred)) {
    if (comp.status === "complete") inferredComplete += 1;
    if (comp.status === "failed") inferredFailed += 1;
  }
  total += inferredTotal;
  complete += inferredComplete;
  failed += inferredFailed;
  phases.inferred = { complete: inferredComplete, total: inferredTotal };

  // Utilities
  const utilitiesTotal = Object.keys(state.phases.utilities).length;
  let utilitiesComplete = 0;
  let utilitiesFailed = 0;
  for (const comp of Object.values(state.phases.utilities)) {
    if (comp.status === "complete") utilitiesComplete += 1;
    if (comp.status === "failed") utilitiesFailed += 1;
  }
  total += utilitiesTotal;
  complete += utilitiesComplete;
  failed += utilitiesFailed;
  phases.utilities = { complete: utilitiesComplete, total: utilitiesTotal };

  // Registry (1 item)
  total += 1;
  if (state.phases.registry.status === "complete") complete += 1;
  if (state.phases.registry.status === "failed") failed += 1;
  phases.registry = {
    complete: state.phases.registry.status === "complete" ? 1 : 0,
    total: 1,
  };

  return {
    total,
    complete,
    failed,
    pending: total - complete - failed,
    phases,
  };
}

/**
 * Get list of all completed component names (for imports/exports).
 */
export function getCompletedComponents(state: CodegenState): string[] {
  const completed: string[] = [];

  // Primitives
  if (state.phases.primitives.status === "complete") {
    completed.push(...state.phases.primitives.components);
  }

  // Detected
  for (const [name, comp] of Object.entries(state.phases.detected)) {
    if (comp.status === "complete") {
      completed.push(name);
    }
  }

  // Inferred
  for (const [name, comp] of Object.entries(state.phases.inferred)) {
    if (comp.status === "complete") {
      completed.push(name);
    }
  }

  // Utilities
  for (const [name, comp] of Object.entries(state.phases.utilities)) {
    if (comp.status === "complete") {
      completed.push(name);
    }
  }

  return completed.sort();
}

/**
 * Reset failed components to pending for retry.
 */
export function resetFailedToPending(state: CodegenState): number {
  let resetCount = 0;

  if (state.phases.tokens.status === "failed") {
    state.phases.tokens.status = "pending";
    delete state.phases.tokens.error;
    resetCount += 1;
  }

  if (state.phases.primitives.status === "failed") {
    state.phases.primitives.status = "pending";
    delete state.phases.primitives.error;
    resetCount += 1;
  }

  for (const comp of Object.values(state.phases.detected)) {
    if (comp.status === "failed") {
      comp.status = "pending";
      delete comp.error;
      resetCount += 1;
    }
  }

  for (const comp of Object.values(state.phases.inferred)) {
    if (comp.status === "failed") {
      comp.status = "pending";
      delete comp.error;
      resetCount += 1;
    }
  }

  for (const comp of Object.values(state.phases.utilities)) {
    if (comp.status === "failed") {
      comp.status = "pending";
      delete comp.error;
      resetCount += 1;
    }
  }

  if (state.phases.registry.status === "failed") {
    state.phases.registry.status = "pending";
    delete state.phases.registry.error;
    resetCount += 1;
  }

  return resetCount;
}
