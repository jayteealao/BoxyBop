/**
 * Storybook Configuration Generator.
 *
 * Generates Storybook config files and package.json for UI packages.
 * Uses locked tokens as the source of truth for theming.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { StyleGuideLocked } from "@boxybop/ir";

// =============================================================================
// Package.json Template
// =============================================================================

export function generatePackageJson(setSlug: string): string {
  const pkg = {
    name: `@boxybop/ui-${setSlug}`,
    version: "0.1.0",
    private: true,
    type: "module",
    main: "./components/index.ts",
    scripts: {
      storybook: "storybook dev -p 6006",
      "build-storybook": "storybook build",
      "test:visual": "test-storybook --coverage",
      "snapshot:update": "test-storybook --updateSnapshot",
      "snapshot:compare":
        "node --import tsx ./scripts/compare-snapshots.ts",
    },
    dependencies: {
      react: "^18.3.1",
      "react-dom": "^18.3.1",
      clsx: "^2.1.0",
      "tailwind-merge": "^2.2.0",
    },
    devDependencies: {
      "@storybook/addon-essentials": "^8.4.0",
      "@storybook/addon-interactions": "^8.4.0",
      "@storybook/addon-links": "^8.4.0",
      "@storybook/blocks": "^8.4.0",
      "@storybook/react": "^8.4.0",
      "@storybook/react-vite": "^8.4.0",
      "@storybook/test": "^8.4.0",
      "@storybook/test-runner": "^0.19.0",
      storybook: "^8.4.0",
      vite: "^5.4.0",
      typescript: "^5.3.0",
      tsx: "^4.7.0",
      "@types/react": "^18.3.0",
      "@types/react-dom": "^18.3.0",
      playwright: "^1.48.0",
      pngjs: "^7.0.0",
      pixelmatch: "^6.0.0",
      "jest-image-snapshot": "^6.4.0",
      "@types/pngjs": "^6.0.0",
    },
  };

  return JSON.stringify(pkg, null, 2);
}

// =============================================================================
// Storybook Main Config
// =============================================================================

export function generateStorybookMain(): string {
  return `import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../components/**/*.stories.@(ts|tsx)"],
  addons: [
    "@storybook/addon-links",
    "@storybook/addon-essentials",
    "@storybook/addon-interactions",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  docs: {
    autodocs: "tag",
  },
  viteFinal: async (config) => {
    // Ensure tokens.css is loaded
    return config;
  },
};

export default config;
`;
}

// =============================================================================
// Storybook Preview Config
// =============================================================================

export function generateStorybookPreview(lockedTokens: StyleGuideLocked): string {
  // Extract background color from tokens
  const bgToken = lockedTokens.tokens.colors.find(
    (c) => c.role?.includes("background") || c.name.includes("background")
  );
  const surfaceToken = lockedTokens.tokens.colors.find(
    (c) => c.role?.includes("surface") || c.name.includes("surface")
  );

  const bgColor = bgToken?.value || surfaceToken?.value || "#ffffff";

  return `import type { Preview } from "@storybook/react";
import "../tokens.css";

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "design-system",
      values: [
        {
          name: "design-system",
          value: "${bgColor}",
        },
        {
          name: "light",
          value: "#ffffff",
        },
        {
          name: "dark",
          value: "#1a1a1a",
        },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
`;
}

// =============================================================================
// Storybook Test Runner Config
// =============================================================================

export function generateTestRunnerConfig(): string {
  return `import type { TestRunnerConfig } from "@storybook/test-runner";
import { toMatchImageSnapshot } from "jest-image-snapshot";

const config: TestRunnerConfig = {
  setup() {
    expect.extend({ toMatchImageSnapshot });
  },
  async postVisit(page, context) {
    // Wait for fonts and images to load
    await page.waitForLoadState("networkidle");

    // Take screenshot for visual regression
    const image = await page.screenshot();
    expect(image).toMatchImageSnapshot({
      customSnapshotsDir: \`./snapshots/\${context.id.split("--")[0]}\`,
      customSnapshotIdentifier: context.id,
      failureThreshold: 0.01,
      failureThresholdType: "percent",
    });
  },
};

export default config;
`;
}

// =============================================================================
// Snapshot Compare Script
// =============================================================================

export function generateSnapshotCompareScript(): string {
  return `#!/usr/bin/env tsx
/**
 * Snapshot Comparison Script.
 *
 * Compares current snapshots against baseline.
 * Usage: pnpm snapshot:compare [--update]
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

interface CompareResult {
  story: string;
  status: "match" | "diff" | "new" | "missing";
  diffPixels?: number;
  diffPercent?: number;
}

async function findSnapshots(dir: string): Promise<string[]> {
  const files: string[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await findSnapshots(fullPath)));
      } else if (entry.name.endsWith(".png")) {
        files.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist
  }
  return files;
}

async function compareImages(
  baseline: string,
  current: string
): Promise<{ diffPixels: number; diffPercent: number }> {
  const baselineData = await fs.readFile(baseline);
  const currentData = await fs.readFile(current);

  const baselinePng = PNG.sync.read(baselineData);
  const currentPng = PNG.sync.read(currentData);

  if (
    baselinePng.width !== currentPng.width ||
    baselinePng.height !== currentPng.height
  ) {
    return { diffPixels: -1, diffPercent: 100 };
  }

  const { width, height } = baselinePng;
  const diff = new PNG({ width, height });

  const diffPixels = pixelmatch(
    baselinePng.data,
    currentPng.data,
    diff.data,
    width,
    height,
    { threshold: 0.1 }
  );

  const totalPixels = width * height;
  const diffPercent = (diffPixels / totalPixels) * 100;

  return { diffPixels, diffPercent };
}

async function main() {
  const args = process.argv.slice(2);
  const updateMode = args.includes("--update");

  const snapshotsDir = path.resolve("./snapshots");
  const baselineDir = path.resolve("./snapshots-baseline");

  const currentSnapshots = await findSnapshots(snapshotsDir);
  const baselineSnapshots = await findSnapshots(baselineDir);

  const baselineSet = new Set(
    baselineSnapshots.map((s) => path.relative(baselineDir, s))
  );
  const currentSet = new Set(
    currentSnapshots.map((s) => path.relative(snapshotsDir, s))
  );

  const results: CompareResult[] = [];

  // Check current snapshots against baseline
  for (const snapshot of currentSnapshots) {
    const relativePath = path.relative(snapshotsDir, snapshot);
    const baselinePath = path.join(baselineDir, relativePath);
    const storyName = path.basename(relativePath, ".png");

    if (!baselineSet.has(relativePath)) {
      results.push({ story: storyName, status: "new" });
      if (updateMode) {
        await fs.mkdir(path.dirname(baselinePath), { recursive: true });
        await fs.copyFile(snapshot, baselinePath);
      }
    } else {
      const { diffPixels, diffPercent } = await compareImages(
        baselinePath,
        snapshot
      );
      if (diffPercent < 0.01) {
        results.push({ story: storyName, status: "match" });
      } else {
        results.push({
          story: storyName,
          status: "diff",
          diffPixels,
          diffPercent,
        });
        if (updateMode) {
          await fs.copyFile(snapshot, baselinePath);
        }
      }
    }
  }

  // Check for missing snapshots (in baseline but not current)
  for (const baseline of baselineSnapshots) {
    const relativePath = path.relative(baselineDir, baseline);
    if (!currentSet.has(relativePath)) {
      const storyName = path.basename(relativePath, ".png");
      results.push({ story: storyName, status: "missing" });
    }
  }

  // Print results
  console.log("\\n" + "=".repeat(60));
  console.log("SNAPSHOT COMPARISON");
  console.log("=".repeat(60));

  const matches = results.filter((r) => r.status === "match");
  const diffs = results.filter((r) => r.status === "diff");
  const newOnes = results.filter((r) => r.status === "new");
  const missing = results.filter((r) => r.status === "missing");

  console.log(\`\\nMatched: \${matches.length}\`);
  console.log(\`Changed: \${diffs.length}\`);
  console.log(\`New: \${newOnes.length}\`);
  console.log(\`Missing: \${missing.length}\`);

  if (diffs.length > 0) {
    console.log("\\nChanged snapshots:");
    for (const diff of diffs) {
      console.log(\`  - \${diff.story}: \${diff.diffPercent?.toFixed(2)}% different\`);
    }
  }

  if (newOnes.length > 0) {
    console.log("\\nNew snapshots:");
    for (const n of newOnes) {
      console.log(\`  - \${n.story}\`);
    }
  }

  if (missing.length > 0) {
    console.log("\\nMissing snapshots:");
    for (const m of missing) {
      console.log(\`  - \${m.story}\`);
    }
  }

  if (updateMode) {
    console.log("\\nBaseline updated.");
  }

  const hasFailures = diffs.length > 0 || missing.length > 0;
  if (hasFailures && !updateMode) {
    console.log("\\n❌ Snapshot comparison FAILED\\n");
    process.exit(1);
  } else {
    console.log("\\n✅ Snapshot comparison passed\\n");
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
`;
}

// =============================================================================
// TypeScript Config
// =============================================================================

export function generateTsConfig(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        lib: ["DOM", "DOM.Iterable", "ESNext"],
        module: "ESNext",
        moduleResolution: "bundler",
        jsx: "react-jsx",
        strict: true,
        skipLibCheck: true,
        esModuleInterop: true,
        isolatedModules: true,
        noEmit: true,
        resolveJsonModule: true,
        allowSyntheticDefaultImports: true,
        forceConsistentCasingInFileNames: true,
      },
      include: ["components/**/*", ".storybook/**/*", "scripts/**/*"],
      exclude: ["node_modules", "snapshots", "snapshots-baseline"],
    },
    null,
    2
  );
}

// =============================================================================
// Main Setup Function
// =============================================================================

export async function setupStorybook(
  outputDir: string,
  setSlug: string,
  lockedTokens: StyleGuideLocked
): Promise<void> {
  // Create .storybook directory
  const storybookDir = path.join(outputDir, ".storybook");
  await fs.mkdir(storybookDir, { recursive: true });

  // Create scripts directory
  const scriptsDir = path.join(outputDir, "scripts");
  await fs.mkdir(scriptsDir, { recursive: true });

  // Write files
  await Promise.all([
    fs.writeFile(
      path.join(outputDir, "package.json"),
      generatePackageJson(setSlug)
    ),
    fs.writeFile(
      path.join(outputDir, "tsconfig.json"),
      generateTsConfig()
    ),
    fs.writeFile(
      path.join(storybookDir, "main.ts"),
      generateStorybookMain()
    ),
    fs.writeFile(
      path.join(storybookDir, "preview.ts"),
      generateStorybookPreview(lockedTokens)
    ),
    fs.writeFile(
      path.join(storybookDir, "test-runner.ts"),
      generateTestRunnerConfig()
    ),
    fs.writeFile(
      path.join(scriptsDir, "compare-snapshots.ts"),
      generateSnapshotCompareScript()
    ),
  ]);

  // Create empty snapshots-baseline directory
  const baselineDir = path.join(outputDir, "snapshots-baseline");
  await fs.mkdir(baselineDir, { recursive: true });
  await fs.writeFile(
    path.join(baselineDir, ".gitkeep"),
    "# Baseline snapshots for visual regression testing\n"
  );

  console.log(`[Storybook] Configuration generated at ${storybookDir}`);
}
