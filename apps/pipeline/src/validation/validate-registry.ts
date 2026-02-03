/**
 * Registry Validation Script.
 *
 * Validates a generated UI package:
 * 1. registry.json references real files
 * 2. Components compile (TypeScript)
 * 3. Stories compile (TypeScript)
 *
 * Usage:
 *   pnpm --filter @boxybop/pipeline validate:registry <package-path>
 *
 * Example:
 *   pnpm --filter @boxybop/pipeline validate:registry ./packages/ui-my-app
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { validateRegistry, type Registry } from "@boxybop/registry";

// =============================================================================
// Types
// =============================================================================

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface FileCheckResult {
  path: string;
  exists: boolean;
  isComponent: boolean;
  isStory: boolean;
}

// =============================================================================
// File Validation
// =============================================================================

/**
 * Check if all files referenced in registry.json exist.
 */
async function validateFileReferences(
  packageDir: string,
  registry: Registry
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const checked: FileCheckResult[] = [];

  for (const item of registry.items) {
    if (!item.files) continue;

    for (const file of item.files) {
      const filePath = path.join(packageDir, file.path);
      let exists = false;

      try {
        await fs.access(filePath);
        exists = true;
      } catch {
        exists = false;
      }

      const isComponent = file.type === "registry:component" || file.type === "registry:ui";
      const isStory = file.path.includes(".stories.");

      checked.push({ path: file.path, exists, isComponent, isStory });

      if (!exists) {
        if (isComponent) {
          errors.push(`Missing component file: ${file.path} (item: ${item.name})`);
        } else if (isStory) {
          warnings.push(`Missing story file: ${file.path} (item: ${item.name})`);
        } else {
          warnings.push(`Missing file: ${file.path} (item: ${item.name})`);
        }
      }
    }
  }

  const componentCount = checked.filter((c) => c.isComponent).length;
  const existingComponents = checked.filter((c) => c.isComponent && c.exists).length;
  const storyCount = checked.filter((c) => c.isStory).length;
  const existingStories = checked.filter((c) => c.isStory && c.exists).length;

  console.log(`  Components: ${existingComponents}/${componentCount} exist`);
  console.log(`  Stories: ${existingStories}/${storyCount} exist`);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// =============================================================================
// TypeScript Compilation
// =============================================================================

/**
 * Run TypeScript compilation check on a directory.
 */
async function runTypeCheck(packageDir: string): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if tsconfig.json exists
  const tsconfigPath = path.join(packageDir, "tsconfig.json");
  try {
    await fs.access(tsconfigPath);
  } catch {
    warnings.push("No tsconfig.json found, skipping TypeScript check");
    return { valid: true, errors, warnings };
  }

  return new Promise((resolve) => {
    const tsc = spawn("npx", ["tsc", "--noEmit", "--project", tsconfigPath], {
      cwd: packageDir,
      shell: true,
    });

    let stdout = "";
    let stderr = "";

    tsc.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    tsc.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    tsc.on("close", (code) => {
      if (code !== 0) {
        // Parse TypeScript errors
        const output = stdout + stderr;
        const errorLines = output
          .split("\n")
          .filter((line) => line.includes("error TS"))
          .slice(0, 10); // Limit to first 10 errors

        if (errorLines.length > 0) {
          errors.push(...errorLines);
        } else {
          errors.push(`TypeScript compilation failed (exit code ${code})`);
        }
      }

      resolve({
        valid: errors.length === 0,
        errors,
        warnings,
      });
    });

    tsc.on("error", (err) => {
      errors.push(`Failed to run tsc: ${err.message}`);
      resolve({ valid: false, errors, warnings });
    });
  });
}

/**
 * Check if components compile individually.
 */
async function validateComponentCompilation(
  packageDir: string,
  registry: Registry
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Collect all component files
  const componentFiles: string[] = [];
  for (const item of registry.items) {
    if (!item.files) continue;
    for (const file of item.files) {
      if (
        file.type === "registry:component" ||
        file.type === "registry:ui" ||
        file.path.endsWith(".tsx")
      ) {
        const filePath = path.join(packageDir, file.path);
        try {
          await fs.access(filePath);
          componentFiles.push(filePath);
        } catch {
          // File doesn't exist, already reported in file validation
        }
      }
    }
  }

  if (componentFiles.length === 0) {
    warnings.push("No component files found to validate");
    return { valid: true, errors, warnings };
  }

  // Run tsc with isolated modules on component files
  return new Promise((resolve) => {
    const tsc = spawn(
      "npx",
      [
        "tsc",
        "--noEmit",
        "--isolatedModules",
        "--esModuleInterop",
        "--jsx",
        "react-jsx",
        "--moduleResolution",
        "node",
        "--target",
        "ES2020",
        "--skipLibCheck",
        ...componentFiles,
      ],
      {
        cwd: packageDir,
        shell: true,
      }
    );

    let stdout = "";
    let stderr = "";

    tsc.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    tsc.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    tsc.on("close", (code) => {
      if (code !== 0) {
        const output = stdout + stderr;
        const errorLines = output
          .split("\n")
          .filter((line) => line.includes("error TS") || line.includes("Error:"))
          .slice(0, 10);

        if (errorLines.length > 0) {
          errors.push(...errorLines);
        } else if (output.trim()) {
          errors.push(`Compilation failed: ${output.slice(0, 500)}`);
        } else {
          errors.push(`TypeScript compilation failed (exit code ${code})`);
        }
      }

      console.log(`  Checked ${componentFiles.length} component files`);

      resolve({
        valid: errors.length === 0,
        errors,
        warnings,
      });
    });

    tsc.on("error", (err) => {
      errors.push(`Failed to run tsc: ${err.message}`);
      resolve({ valid: false, errors, warnings });
    });
  });
}

// =============================================================================
// Main
// =============================================================================

export async function validateRegistryPackage(packageDir: string): Promise<{
  valid: boolean;
  fileCheck: ValidationResult;
  componentCheck: ValidationResult;
  errors: string[];
  warnings: string[];
}> {
  console.log(`\nValidating registry package: ${packageDir}\n`);

  // Load registry.json
  const registryPath = path.join(packageDir, "registry.json");
  let registry: Registry;

  try {
    const content = await fs.readFile(registryPath, "utf-8");
    const parsed = JSON.parse(content);
    registry = validateRegistry(parsed);
    console.log(`✓ registry.json is valid (${registry.items.length} items)\n`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      valid: false,
      fileCheck: { valid: false, errors: [`Invalid registry.json: ${message}`], warnings: [] },
      componentCheck: { valid: true, errors: [], warnings: [] },
      errors: [`Invalid registry.json: ${message}`],
      warnings: [],
    };
  }

  // Step 1: Validate file references
  console.log("Step 1: Checking file references...");
  const fileCheck = await validateFileReferences(packageDir, registry);

  if (fileCheck.errors.length > 0) {
    console.log(`  ✗ ${fileCheck.errors.length} missing files\n`);
  } else {
    console.log(`  ✓ All referenced files exist\n`);
  }

  // Step 2: Validate component compilation
  console.log("Step 2: Checking component compilation...");
  const componentCheck = await validateComponentCompilation(packageDir, registry);

  if (componentCheck.errors.length > 0) {
    console.log(`  ✗ Compilation errors found\n`);
  } else {
    console.log(`  ✓ Components compile successfully\n`);
  }

  // Aggregate results
  const allErrors = [...fileCheck.errors, ...componentCheck.errors];
  const allWarnings = [...fileCheck.warnings, ...componentCheck.warnings];

  return {
    valid: allErrors.length === 0,
    fileCheck,
    componentCheck,
    errors: allErrors,
    warnings: allWarnings,
  };
}

// =============================================================================
// CLI Entry Point
// =============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: validate-registry <package-path>");
    console.error("Example: validate-registry ./packages/ui-my-app");
    process.exit(1);
  }

  const packageDir = path.resolve(args[0]);

  try {
    await fs.access(packageDir);
  } catch {
    console.error(`Error: Package directory not found: ${packageDir}`);
    process.exit(1);
  }

  const result = await validateRegistryPackage(packageDir);

  // Print summary
  console.log("=".repeat(60));
  console.log("VALIDATION SUMMARY");
  console.log("=".repeat(60));

  if (result.errors.length > 0) {
    console.log(`\n❌ ERRORS (${result.errors.length}):`);
    for (const error of result.errors) {
      console.log(`  - ${error}`);
    }
  }

  if (result.warnings.length > 0) {
    console.log(`\n⚠️  WARNINGS (${result.warnings.length}):`);
    for (const warning of result.warnings) {
      console.log(`  - ${warning}`);
    }
  }

  if (result.valid) {
    console.log("\n✅ VALIDATION PASSED\n");
    process.exit(0);
  } else {
    console.log("\n❌ VALIDATION FAILED\n");
    process.exit(1);
  }
}

// Run if executed directly
main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
