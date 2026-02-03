/**
 * Retry utilities with exponential backoff.
 *
 * Provides robust retry logic for external API calls (Replicate, Gemini, Claude)
 * to handle transient network failures gracefully.
 */

/**
 * Options for retry behavior.
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in milliseconds (default: 1000) */
  initialDelayMs?: number;
  /** Maximum delay in milliseconds (default: 10000) */
  maxDelayMs?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Function to determine if an error is retryable (default: network errors) */
  isRetryable?: (error: unknown) => boolean;
  /** Callback for retry events (for logging) */
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

/**
 * Default function to determine if an error is retryable.
 * Retries on network errors and 5xx server errors.
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Network errors
    if (
      message.includes("network") ||
      message.includes("fetch failed") ||
      message.includes("econnreset") ||
      message.includes("econnrefused") ||
      message.includes("etimedout") ||
      message.includes("socket hang up") ||
      message.includes("dns") ||
      message.includes("timeout")
    ) {
      return true;
    }

    // Rate limiting (should retry after delay)
    if (message.includes("rate limit") || message.includes("429")) {
      return true;
    }

    // Server errors (5xx)
    if (message.includes("500") || message.includes("502") || message.includes("503") || message.includes("504")) {
      return true;
    }
  }

  // Check for HTTP response objects with status codes
  if (typeof error === "object" && error !== null) {
    const err = error as Record<string, unknown>;
    if (typeof err.status === "number" && err.status >= 500) {
      return true;
    }
    if (err.code === "ECONNRESET" || err.code === "ETIMEDOUT" || err.code === "ECONNREFUSED") {
      return true;
    }
  }

  return false;
}

/**
 * Sleep for a specified number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic and exponential backoff.
 *
 * @param fn - The async function to execute
 * @param options - Retry configuration options
 * @returns The result of the function
 * @throws The last error if all retries fail
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => fetchExternalApi(),
 *   {
 *     maxRetries: 3,
 *     onRetry: (attempt, error, delay) => {
 *       console.log(`Retry ${attempt} after ${delay}ms: ${error}`);
 *     }
 *   }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
    isRetryable = isRetryableError,
    onRetry,
  } = options;

  let lastError: unknown;
  let delayMs = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if we've exhausted attempts or error is not retryable
      if (attempt >= maxRetries || !isRetryable(error)) {
        throw error;
      }

      // Calculate delay with jitter (±10%)
      const jitter = delayMs * 0.1 * (Math.random() * 2 - 1);
      const actualDelay = Math.min(delayMs + jitter, maxDelayMs);

      // Notify about retry
      if (onRetry) {
        onRetry(attempt + 1, error, actualDelay);
      }

      // Wait before retrying
      await sleep(actualDelay);

      // Increase delay for next attempt
      delayMs = Math.min(delayMs * backoffMultiplier, maxDelayMs);
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError;
}

/**
 * Result type for operations that can partially fail.
 */
export interface BatchResult<T> {
  /** Successfully processed items */
  succeeded: T[];
  /** Failed items with their errors */
  failed: Array<{ item: unknown; error: string }>;
  /** Total items processed */
  total: number;
  /** Number of successful items */
  successCount: number;
  /** Number of failed items */
  failCount: number;
}

/**
 * Process items in batch with individual retry logic.
 * Continues processing even if some items fail.
 *
 * @param items - Items to process
 * @param processor - Function to process each item
 * @param options - Retry options for each item
 * @returns Results with success/failure tracking
 */
export async function batchWithRetry<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: RetryOptions = {}
): Promise<BatchResult<R>> {
  const succeeded: R[] = [];
  const failed: Array<{ item: unknown; error: string }> = [];

  for (const item of items) {
    try {
      const result = await withRetry(() => processor(item), options);
      succeeded.push(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      failed.push({ item, error: errorMessage });
    }
  }

  return {
    succeeded,
    failed,
    total: items.length,
    successCount: succeeded.length,
    failCount: failed.length,
  };
}
