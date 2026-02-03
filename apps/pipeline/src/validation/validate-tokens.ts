/**
 * Token Lock Validation Script.
 *
 * Validates that generated tokens match the locked tokens:
 * 1. Compares tokens.css against locked_tokens.json
 * 2. Verifies all locked tokens are present in generated CSS
 * 3. Checks for unauthorized new tokens
 *
 * Usage:
 *   pnpm --filter @boxybop/pipeline validate:tokens <package-path> <locked-tokens-path>
 *
 * Example:
 *   pnpm --filter @boxybop/pipeline validate:tokens ./packages/ui-my-app ./runs/abc123/style/locked_tokens.json
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { StyleGuideLockedSchema, type StyleGuideLocked } from "@boxybop/ir";

// =============================================================================
// Types
// =============================================================================

interface TokenValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    expectedTokens: number;
    foundTokens: number;
    missingTokens: string[];
    extraTokens: string[];
  };
}

// =============================================================================
// Token Extraction
// =============================================================================

/**
 * Extract CSS custom properties from a CSS string.
 */
function extractCssVars(css: string): Map<string, string> {
  const vars = new Map<string, string>();

  // Match CSS custom property definitions: --name: value;
  const regex = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let match;

  while ((match = regex.exec(css)) !== null) {
    const name = match[1];
    const value = match[2].trim();
    vars.set(name, value);
  }

  return vars;
}

/**
 * Get all expected CSS vars from locked tokens.
 */
function getExpectedTokens(lockedTokens: StyleGuideLocked): Map<string, string> {
  const expected = new Map<string, string>();

  // Colors
  for (const token of lockedTokens.tokens.colors) {
    expected.set(token.cssVar, token.value);
  }

  // Typography
  for (const token of lockedTokens.tokens.typography) {
    expected.set(token.cssVar, token.fontSize);
    // Also check for weight variant (fontWeight can be string or number)
    expected.set(`${token.cssVar}-weight`, String(token.fontWeight));
    if (token.lineHeight !== undefined) {
      expected.set(`${token.cssVar}-line-height`, String(token.lineHeight));
    }
  }

  // Spacing
  for (const token of lockedTokens.tokens.spacing) {
    expected.set(token.cssVar, token.value);
  }

  // Radius
  for (const token of lockedTokens.tokens.radius) {
    expected.set(token.cssVar, token.value);
  }

  // Shadows
  for (const token of lockedTokens.tokens.shadows) {
    expected.set(token.cssVar, token.value);
  }

  // Borders (construct value from width, style, color)
  for (const token of lockedTokens.tokens.borders) {
    // Border tokens have width/style/color, construct CSS shorthand
    const borderValue = token.color
      ? `${token.width} ${token.style} ${token.color}`
      : `${token.width} ${token.style}`;
    expected.set(token.cssVar, borderValue);
  }

  // Z-Index
  for (const token of lockedTokens.tokens.zIndex) {
    expected.set(token.cssVar, String(token.value));
  }

  // Motion (use duration as primary value)
  for (const token of lockedTokens.tokens.motion) {
    expected.set(token.cssVar, token.duration);
    if (token.easing) {
      expected.set(`${token.cssVar}-easing`, token.easing);
    }
  }

  return expected;
}

// =============================================================================
// Hash Validation
// =============================================================================

/**
 * Compute a normalized hash of token values.
 */
function computeTokensHash(tokens: Map<string, string>): string {
  // Sort keys and create deterministic string
  const sorted = Array.from(tokens.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const normalized = sorted.map(([k, v]) => `${k}:${v}`).join("|");
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

/**
 * Validate token hash matches locked tokens.
 */
function validateTokenHash(
  generatedTokens: Map<string, string>,
  lockedTokens: StyleGuideLocked
): { valid: boolean; generatedHash: string; lockedHash: string } {
  // Filter to only tokens that are in the locked set (base tokens)
  const expected = getExpectedTokens(lockedTokens);
  const baseTokensInGenerated = new Map<string, string>();

  for (const [key, value] of expected) {
    const generatedValue = generatedTokens.get(key);
    if (generatedValue) {
      baseTokensInGenerated.set(key, generatedValue);
    }
  }

  const generatedHash = computeTokensHash(baseTokensInGenerated);
  const lockedHash = lockedTokens.tokensHash;

  return {
    valid: generatedHash === lockedHash || baseTokensInGenerated.size === expected.size,
    generatedHash,
    lockedHash,
  };
}

// =============================================================================
// Main Validation
// =============================================================================

export async function validateTokens(
  packageDir: string,
  lockedTokensPath: string
): Promise<TokenValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Load locked tokens
  let lockedTokens: StyleGuideLocked;
  try {
    const content = await fs.readFile(lockedTokensPath, "utf-8");
    lockedTokens = StyleGuideLockedSchema.parse(JSON.parse(content));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      valid: false,
      errors: [`Failed to load locked_tokens.json: ${message}`],
      warnings: [],
      stats: {
        expectedTokens: 0,
        foundTokens: 0,
        missingTokens: [],
        extraTokens: [],
      },
    };
  }

  // Load generated tokens.css
  const tokensCssPath = path.join(packageDir, "tokens.css");
  let tokensCss: string;
  try {
    tokensCss = await fs.readFile(tokensCssPath, "utf-8");
  } catch {
    return {
      valid: false,
      errors: [`tokens.css not found at ${tokensCssPath}`],
      warnings: [],
      stats: {
        expectedTokens: 0,
        foundTokens: 0,
        missingTokens: [],
        extraTokens: [],
      },
    };
  }

  // Extract tokens
  const generatedTokens = extractCssVars(tokensCss);
  const expectedTokens = getExpectedTokens(lockedTokens);

  console.log(`  Locked tokens: ${expectedTokens.size}`);
  console.log(`  Generated tokens: ${generatedTokens.size}`);

  // Find missing tokens
  const missingTokens: string[] = [];
  for (const [key] of expectedTokens) {
    if (!generatedTokens.has(key)) {
      missingTokens.push(key);
    }
  }

  // Find extra tokens (potential new base tokens)
  const extraTokens: string[] = [];
  for (const [key] of generatedTokens) {
    if (!expectedTokens.has(key)) {
      // Check if it's a derivative (like -rgb or -hsl variants)
      const isDerivative = Array.from(expectedTokens.keys()).some(
        (expected) => key.startsWith(expected + "-")
      );
      if (!isDerivative) {
        extraTokens.push(key);
      }
    }
  }

  // Validate values match
  const valueMismatches: string[] = [];
  for (const [key, expectedValue] of expectedTokens) {
    const generatedValue = generatedTokens.get(key);
    if (generatedValue && generatedValue !== expectedValue) {
      // Normalize and compare (handle whitespace differences)
      const normalizedExpected = expectedValue.replace(/\s+/g, " ").trim();
      const normalizedGenerated = generatedValue.replace(/\s+/g, " ").trim();
      if (normalizedExpected !== normalizedGenerated) {
        valueMismatches.push(`${key}: expected "${expectedValue}", got "${generatedValue}"`);
      }
    }
  }

  // Build errors
  if (missingTokens.length > 0) {
    errors.push(`Missing ${missingTokens.length} locked tokens:`);
    for (const token of missingTokens.slice(0, 10)) {
      errors.push(`  - ${token}`);
    }
    if (missingTokens.length > 10) {
      errors.push(`  ... and ${missingTokens.length - 10} more`);
    }
  }

  if (extraTokens.length > 0) {
    errors.push(`Found ${extraTokens.length} unauthorized new base tokens:`);
    for (const token of extraTokens.slice(0, 10)) {
      errors.push(`  - ${token}`);
    }
    if (extraTokens.length > 10) {
      errors.push(`  ... and ${extraTokens.length - 10} more`);
    }
  }

  if (valueMismatches.length > 0) {
    errors.push(`Found ${valueMismatches.length} value mismatches:`);
    for (const mismatch of valueMismatches.slice(0, 5)) {
      errors.push(`  - ${mismatch}`);
    }
    if (valueMismatches.length > 5) {
      errors.push(`  ... and ${valueMismatches.length - 5} more`);
    }
  }

  // Validate hash
  const hashResult = validateTokenHash(generatedTokens, lockedTokens);
  if (!hashResult.valid && missingTokens.length === 0 && valueMismatches.length === 0) {
    warnings.push(
      `Token hash mismatch (generated: ${hashResult.generatedHash.slice(0, 12)}..., locked: ${hashResult.lockedHash.slice(0, 12)}...)`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      expectedTokens: expectedTokens.size,
      foundTokens: generatedTokens.size,
      missingTokens,
      extraTokens,
    },
  };
}

// =============================================================================
// CLI Entry Point
// =============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error("Usage: validate-tokens <package-path> <locked-tokens-path>");
    console.error("Example: validate-tokens ./packages/ui-my-app ./runs/abc/style/locked_tokens.json");
    process.exit(1);
  }

  const packageDir = path.resolve(args[0]);
  const lockedTokensPath = path.resolve(args[1]);

  // Check paths exist
  try {
    await fs.access(packageDir);
  } catch {
    console.error(`Error: Package directory not found: ${packageDir}`);
    process.exit(1);
  }

  try {
    await fs.access(lockedTokensPath);
  } catch {
    console.error(`Error: Locked tokens file not found: ${lockedTokensPath}`);
    process.exit(1);
  }

  console.log(`\nValidating tokens for: ${packageDir}`);
  console.log(`Against locked tokens: ${lockedTokensPath}\n`);

  const result = await validateTokens(packageDir, lockedTokensPath);

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("TOKEN VALIDATION SUMMARY");
  console.log("=".repeat(60));

  console.log(`\nStats:`);
  console.log(`  Expected tokens: ${result.stats.expectedTokens}`);
  console.log(`  Found tokens: ${result.stats.foundTokens}`);
  console.log(`  Missing: ${result.stats.missingTokens.length}`);
  console.log(`  Extra: ${result.stats.extraTokens.length}`);

  if (result.errors.length > 0) {
    console.log(`\n❌ ERRORS (${result.errors.length}):`);
    for (const error of result.errors) {
      console.log(`  ${error}`);
    }
  }

  if (result.warnings.length > 0) {
    console.log(`\n⚠️  WARNINGS (${result.warnings.length}):`);
    for (const warning of result.warnings) {
      console.log(`  - ${warning}`);
    }
  }

  if (result.valid) {
    console.log("\n✅ TOKEN VALIDATION PASSED\n");
    process.exit(0);
  } else {
    console.log("\n❌ TOKEN VALIDATION FAILED\n");
    process.exit(1);
  }
}

// Run if executed directly
main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
