/**
 * Structured logging middleware and utilities.
 *
 * Provides:
 * - Request ID generation and propagation
 * - Structured log formatting with context
 * - Request/response logging middleware
 */

import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";

// =============================================================================
// Types
// =============================================================================

/**
 * Log levels in order of severity.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Structured log entry.
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  requestId?: string;
  message: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Logger interface.
 */
export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: unknown, context?: Record<string, unknown>): void;
  child(context: Record<string, unknown>): Logger;
}

// =============================================================================
// Request ID
// =============================================================================

const REQUEST_ID_HEADER = "x-request-id";

/**
 * Extend Express Request to include requestId.
 */
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

/**
 * Middleware to add request ID to each request.
 * Uses existing header if present, otherwise generates a new UUID.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers[REQUEST_ID_HEADER] as string) || randomUUID();
  req.requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}

// =============================================================================
// Structured Logger
// =============================================================================

/**
 * Current log level (can be configured via environment).
 */
const LOG_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Check if a log level should be output.
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[LOG_LEVEL];
}

/**
 * Format a log entry for output.
 */
function formatLogEntry(entry: LogEntry): string {
  // In production, output JSON for log aggregation
  if (process.env.NODE_ENV === "production") {
    return JSON.stringify(entry);
  }

  // In development, use a more readable format
  const parts = [
    `[${entry.timestamp}]`,
    `[${entry.level.toUpperCase()}]`,
  ];

  if (entry.requestId) {
    parts.push(`[${entry.requestId.slice(0, 8)}]`);
  }

  parts.push(entry.message);

  if (entry.context && Object.keys(entry.context).length > 0) {
    parts.push(JSON.stringify(entry.context));
  }

  if (entry.error) {
    parts.push(`\n  Error: ${entry.error.name}: ${entry.error.message}`);
    if (entry.error.stack && process.env.NODE_ENV !== "production") {
      parts.push(`\n  ${entry.error.stack}`);
    }
  }

  return parts.join(" ");
}

/**
 * Output a log entry to the appropriate stream.
 */
function outputLog(entry: LogEntry): void {
  const formatted = formatLogEntry(entry);

  if (entry.level === "error") {
    console.error(formatted);
  } else if (entry.level === "warn") {
    console.warn(formatted);
  } else {
    console.log(formatted);
  }
}

/**
 * Create a logger instance with optional base context.
 */
export function createLogger(baseContext: Record<string, unknown> = {}): Logger {
  const log = (
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: unknown
  ): void => {
    if (!shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...baseContext, ...context },
    };

    if (baseContext.requestId) {
      entry.requestId = baseContext.requestId as string;
    }

    if (error) {
      if (error instanceof Error) {
        entry.error = {
          name: error.name,
          message: error.message,
          stack: error.stack,
        };
      } else {
        entry.error = {
          name: "UnknownError",
          message: String(error),
        };
      }
    }

    outputLog(entry);
  };

  return {
    debug: (message, context) => log("debug", message, context),
    info: (message, context) => log("info", message, context),
    warn: (message, context) => log("warn", message, context),
    error: (message, error, context) => log("error", message, context, error),
    child: (childContext) => createLogger({ ...baseContext, ...childContext }),
  };
}

/**
 * Get a logger for a specific request.
 */
export function getRequestLogger(req: Request, component?: string): Logger {
  const context: Record<string, unknown> = {
    requestId: req.requestId,
  };

  if (component) {
    context.component = component;
  }

  return createLogger(context);
}

// =============================================================================
// Request Logging Middleware
// =============================================================================

/**
 * Middleware to log incoming requests and outgoing responses.
 */
export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const logger = getRequestLogger(req);

  // Log incoming request
  logger.info("Request received", {
    method: req.method,
    path: req.path,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    userAgent: req.headers["user-agent"],
    ip: req.ip || req.socket.remoteAddress,
  });

  // Capture response
  const originalSend = res.send;
  res.send = function (body): Response {
    const latencyMs = Date.now() - startTime;

    logger.info("Response sent", {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      latencyMs,
    });

    return originalSend.call(this, body);
  };

  next();
}

// =============================================================================
// Default Logger
// =============================================================================

/**
 * Default logger instance for use outside request context.
 */
export const logger = createLogger();
