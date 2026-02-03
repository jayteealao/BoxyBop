/**
 * File system utilities for the pipeline.
 *
 * Consolidates common file operations to avoid duplication across routes.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

/**
 * Ensure a directory exists, creating it recursively if necessary.
 * This is a common operation used across multiple routes.
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Write JSON data to a file with pretty formatting.
 */
export async function writeJson(filePath: string, data: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  await ensureDir(dir);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Read and parse JSON from a file.
 * Returns null if file doesn't exist.
 */
export async function readJson<T = unknown>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

/**
 * Check if a file exists.
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Write a file with optional read-only permissions.
 * Used for locked tokens that should not be modified after creation.
 */
export async function writeImmutableFile(
  filePath: string,
  content: string
): Promise<void> {
  const dir = path.dirname(filePath);
  await ensureDir(dir);
  await fs.writeFile(filePath, content, "utf-8");

  // Set read-only permissions (0o444)
  try {
    await fs.chmod(filePath, 0o444);
  } catch (err) {
    // Log warning but don't fail - some file systems don't support chmod
    console.warn(`[fsUtils] Could not set read-only permissions on ${filePath}:`, err);
  }
}
