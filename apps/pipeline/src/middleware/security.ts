/**
 * Security middleware and utilities for the pipeline server.
 *
 * Provides:
 * - Path sanitization to prevent path traversal attacks
 * - Rate limiting for expensive endpoints
 * - Input validation helpers
 */

import * as path from "node:path";
import * as fs from "node:fs";
import type { Request, Response, NextFunction } from "express";

// =============================================================================
// Path Sanitization
// =============================================================================

/**
 * Default allowed directories for file operations.
 * Paths are resolved relative to process.cwd().
 */
const DEFAULT_ALLOWED_DIRS = ["./uploads", "./runs", "./packages", "./test/fixtures"];

/**
 * Validates that a path is within one of the allowed directories.
 * Prevents path traversal attacks (e.g., ../../../etc/passwd).
 *
 * @param inputPath - The path to validate (can be absolute or relative)
 * @param allowedDirs - List of allowed base directories
 * @returns The resolved absolute path if valid
 * @throws Error if path is outside allowed directories
 */
export function sanitizePath(
  inputPath: string,
  allowedDirs: string[] = DEFAULT_ALLOWED_DIRS
): string {
  // Resolve the input path to an absolute path
  const resolvedPath = path.resolve(inputPath);

  // Resolve all allowed directories to absolute paths
  const resolvedAllowedDirs = allowedDirs.map((dir) => path.resolve(dir));

  // Check if the resolved path starts with any allowed directory
  const isAllowed = resolvedAllowedDirs.some((allowedDir) => {
    // Ensure we're checking the full directory path (not partial matches)
    // e.g., /uploads should match /uploads/file.png but not /uploads-backup/file.png
    return (
      resolvedPath === allowedDir ||
      resolvedPath.startsWith(allowedDir + path.sep)
    );
  });

  if (!isAllowed) {
    throw new PathTraversalError(
      `Path "${inputPath}" is outside allowed directories`,
      inputPath,
      resolvedAllowedDirs
    );
  }

  return resolvedPath;
}

/**
 * Error thrown when path traversal is detected.
 */
export class PathTraversalError extends Error {
  public readonly inputPath: string;
  public readonly allowedDirs: string[];

  constructor(message: string, inputPath: string, allowedDirs: string[]) {
    super(message);
    this.name = "PathTraversalError";
    this.inputPath = inputPath;
    this.allowedDirs = allowedDirs;
  }
}

/**
 * Check if a path exists and is within allowed directories.
 * Combines sanitization with existence check.
 */
export function validatePathExists(
  inputPath: string,
  allowedDirs?: string[]
): string {
  const sanitized = sanitizePath(inputPath, allowedDirs);

  if (!fs.existsSync(sanitized)) {
    throw new Error(`File not found: ${sanitized}`);
  }

  return sanitized;
}

// =============================================================================
// Rate Limiting
// =============================================================================

/**
 * In-memory rate limiter using a sliding window.
 * For production, use Redis-backed rate limiting.
 */
interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Rate limiter options.
 */
export interface RateLimitOptions {
  /** Window size in milliseconds (default: 60000 = 1 minute) */
  windowMs?: number;
  /** Maximum requests per window (default: 10) */
  maxRequests?: number;
  /** Key generator function (default: uses IP address) */
  keyGenerator?: (req: Request) => string;
  /** Skip function to bypass rate limiting for certain requests */
  skip?: (req: Request) => boolean;
  /** Message to return when rate limited */
  message?: string;
}

/**
 * Create a rate limiting middleware.
 */
export function rateLimit(options: RateLimitOptions = {}) {
  const {
    windowMs = 60000,
    maxRequests = 10,
    keyGenerator = (req) => req.ip || req.socket.remoteAddress || "unknown",
    skip,
    message = "Too many requests, please try again later",
  } = options;

  // Clean up old entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now - entry.windowStart > windowMs) {
        rateLimitStore.delete(key);
      }
    }
  }, windowMs);

  return (req: Request, res: Response, next: NextFunction): void => {
    // Check if we should skip rate limiting
    if (skip && skip(req)) {
      next();
      return;
    }

    const key = keyGenerator(req);
    const now = Date.now();
    let entry = rateLimitStore.get(key);

    // Start a new window if needed
    if (!entry || now - entry.windowStart > windowMs) {
      entry = { count: 0, windowStart: now };
    }

    entry.count++;
    rateLimitStore.set(key, entry);

    // Set rate limit headers
    const remaining = Math.max(0, maxRequests - entry.count);
    const resetTime = entry.windowStart + windowMs;

    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(resetTime / 1000));

    if (entry.count > maxRequests) {
      res.setHeader("Retry-After", Math.ceil((resetTime - now) / 1000));
      res.status(429).json({
        error: "Rate limit exceeded",
        message,
        retryAfter: Math.ceil((resetTime - now) / 1000),
      });
      return;
    }

    next();
  };
}

/**
 * Pre-configured rate limiter for expensive endpoints (API calls to external services).
 * More restrictive: 5 requests per minute.
 */
export const expensiveEndpointLimiter = rateLimit({
  windowMs: 60000,
  maxRequests: 5,
  message: "Rate limit exceeded for expensive operation. This endpoint calls external APIs (Replicate, Gemini, Claude) which incur costs.",
});

/**
 * Pre-configured rate limiter for standard endpoints.
 * Less restrictive: 30 requests per minute.
 */
export const standardLimiter = rateLimit({
  windowMs: 60000,
  maxRequests: 30,
  message: "Too many requests, please try again later",
});

// =============================================================================
// Input Size Limits
// =============================================================================

/**
 * Maximum size for base64 image payloads (10MB decoded = ~13.3MB encoded).
 * This prevents memory exhaustion attacks.
 */
export const MAX_BASE64_SIZE = 13_400_000; // ~10MB decoded

/**
 * Validate base64 string size.
 */
export function validateBase64Size(base64: string, maxSize = MAX_BASE64_SIZE): void {
  if (base64.length > maxSize) {
    throw new Error(
      `Base64 payload too large: ${base64.length} bytes (max: ${maxSize} bytes)`
    );
  }
}
