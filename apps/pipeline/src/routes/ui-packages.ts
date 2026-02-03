/**
 * UI Packages API Routes.
 *
 * Provides endpoints for browsing generated UI packages in Studio:
 * - GET /api/ui-packages - List all generated packages
 * - GET /api/ui-packages/:setSlug/manifest - Get package manifest
 */

import { Router, type IRouter, type Request, type Response } from "express";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { loadManifest, type StudioManifest } from "../codegen/index.js";
import { getEnv } from "../config/env.js";

export const uiPackagesRouter: IRouter = Router();

// Default output directory for UI packages
const UI_PACKAGES_DIR = process.env.UI_PACKAGES_DIR || "output/ui-packages";

/**
 * UIPackage summary for listing.
 */
interface UIPackageSummary {
  setSlug: string;
  packagePath: string;
  storybookUrl?: string;
  generatedAt: string;
  tokensHash: string;
  counts: {
    components: number;
    stories: number;
    tokens: number;
  };
  groupings: string[];
}

/**
 * List all generated UI packages.
 */
uiPackagesRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const packagesDir = path.resolve(UI_PACKAGES_DIR);

    // Check if directory exists
    try {
      await fs.access(packagesDir);
    } catch {
      // No packages yet
      res.json([]);
      return;
    }

    // Read all subdirectories
    const entries = await fs.readdir(packagesDir, { withFileTypes: true });
    const packages: UIPackageSummary[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (!entry.name.startsWith("ui-")) continue;

      const packagePath = path.join(packagesDir, entry.name);
      const manifest = await loadManifest(packagePath);

      if (manifest) {
        packages.push({
          setSlug: manifest.setSlug,
          packagePath,
          storybookUrl: manifest.storybook.url,
          generatedAt: manifest.generatedAt,
          tokensHash: manifest.tokensHash,
          counts: manifest.counts,
          groupings: manifest.groupings,
        });
      } else {
        // Try to get basic info from package.json or state.json
        try {
          const statePath = path.join(packagePath, "state.json");
          const stateContent = await fs.readFile(statePath, "utf-8");
          const state = JSON.parse(stateContent);

          // Extract slug from directory name
          const setSlug = entry.name.replace("ui-", "");

          packages.push({
            setSlug,
            packagePath,
            generatedAt: state.updatedAt || state.createdAt || new Date().toISOString(),
            tokensHash: state.inputChecksum || "unknown",
            counts: {
              components: 0,
              stories: 0,
              tokens: 0,
            },
            groupings: [],
          });
        } catch {
          // Skip packages without valid state
          console.warn(`[UI Packages] Skipping invalid package: ${entry.name}`);
        }
      }
    }

    // Sort by generatedAt (most recent first)
    packages.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());

    res.json(packages);
  } catch (err) {
    console.error("[UI Packages] Error listing packages:", err);
    res.status(500).json({
      error: "Failed to list UI packages",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Get manifest for a specific package.
 */
uiPackagesRouter.get("/:setSlug/manifest", async (req: Request, res: Response) => {
  try {
    const { setSlug } = req.params;
    const packagesDir = path.resolve(UI_PACKAGES_DIR);
    const packagePath = path.join(packagesDir, `ui-${setSlug}`);

    // Check if package exists
    try {
      await fs.access(packagePath);
    } catch {
      res.status(404).json({
        error: "Package not found",
        message: `No package found with slug: ${setSlug}`,
      });
      return;
    }

    // Load manifest
    const manifest = await loadManifest(packagePath);

    if (!manifest) {
      // Try to generate a minimal manifest from available data
      const minimalManifest = await generateMinimalManifest(packagePath, setSlug);
      if (minimalManifest) {
        res.json(minimalManifest);
        return;
      }

      res.status(404).json({
        error: "Manifest not found",
        message: `No studio.manifest.json found for: ${setSlug}`,
      });
      return;
    }

    res.json(manifest);
  } catch (err) {
    console.error("[UI Packages] Error fetching manifest:", err);
    res.status(500).json({
      error: "Failed to fetch manifest",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Generate a minimal manifest from available package data.
 */
async function generateMinimalManifest(
  packagePath: string,
  setSlug: string
): Promise<StudioManifest | null> {
  try {
    // Try to load tokens from tokens.css
    let tokensHash = "unknown";
    try {
      const tokensCss = await fs.readFile(path.join(packagePath, "tokens.css"), "utf-8");
      const hashMatch = tokensCss.match(/Hash:\s*([a-f0-9]+)/);
      if (hashMatch) {
        tokensHash = hashMatch[1];
      }
    } catch {
      // No tokens.css
    }

    // Try to load components from components directory
    const components: StudioManifest["components"] = [];
    try {
      const componentsDir = path.join(packagePath, "components");
      const entries = await fs.readdir(componentsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name === "index.ts") continue;

        components.push({
          name: entry.name,
          group: "Unknown",
          importPath: `@boxybop/ui-${setSlug}/${entry.name}`,
          storyIds: [],
          sourceFiles: [],
          hasStory: false,
        });
      }
    } catch {
      // No components directory
    }

    // Try to read state.json for timestamps
    let generatedAt = new Date().toISOString();
    try {
      const statePath = path.join(packagePath, "state.json");
      const stateContent = await fs.readFile(statePath, "utf-8");
      const state = JSON.parse(stateContent);
      generatedAt = state.updatedAt || state.createdAt || generatedAt;
    } catch {
      // No state.json
    }

    return {
      manifestVersion: "1.0.0",
      setSlug,
      generatedAt,
      tokensHash,
      tokens: {
        colors: [],
        typography: [],
        spacing: [],
        radius: [],
        shadows: [],
        borders: [],
        zIndex: [],
        motion: [],
      },
      components,
      storybook: {
        url: "http://localhost:6006",
        recommendedLinks: [],
      },
      docs: {},
      counts: {
        components: components.length,
        stories: 0,
        tokens: 0,
      },
      groupings: [],
    };
  } catch {
    return null;
  }
}

/**
 * Download package as ZIP (optional endpoint).
 */
uiPackagesRouter.get("/:setSlug/download", async (req: Request, res: Response) => {
  // This is a placeholder - actual ZIP creation would require archiver or similar
  const { setSlug } = req.params;
  const packagesDir = path.resolve(UI_PACKAGES_DIR);
  const packagePath = path.join(packagesDir, `ui-${setSlug}`);

  try {
    await fs.access(packagePath);
  } catch {
    res.status(404).json({
      error: "Package not found",
      message: `No package found with slug: ${setSlug}`,
    });
    return;
  }

  // For now, just return the path
  res.json({
    message: "ZIP download not implemented",
    packagePath,
    suggestion: "Use 'tar -czf' or 'zip -r' locally",
  });
});
