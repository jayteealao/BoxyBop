/**
 * Studio Manifest Generation.
 *
 * Generates studio.manifest.json which provides metadata for the Studio UI
 * to display design systems, tokens, and components.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { StyleGuideLocked, CropAnalysis } from "@boxybop/ir";
import type { CodegenState } from "./types.js";
import { getCompletedComponents, getProgressSummary } from "./state.js";

/**
 * Token info for manifest.
 */
interface TokenInfo {
  name: string;
  cssVar: string;
  value: string;
  category?: string;
  role?: string;
}

/**
 * Typography token info.
 */
interface TypographyTokenInfo {
  name: string;
  cssVar: string;
  fontSize: string;
  fontWeight: string | number;
  lineHeight?: string | number;
}

/**
 * Border token info.
 */
interface BorderTokenInfo {
  name: string;
  cssVar: string;
  width: string;
  style: string;
  color?: string;
}

/**
 * Z-index token info.
 */
interface ZIndexTokenInfo {
  name: string;
  cssVar: string;
  value: number;
}

/**
 * Motion token info.
 */
interface MotionTokenInfo {
  name: string;
  cssVar: string;
  duration: string;
  easing?: string;
}

/**
 * Component info for manifest.
 */
interface ComponentInfo {
  name: string;
  group: string;
  description?: string;
  importPath: string;
  storyIds: string[];
  sourceFiles: string[];
  props?: string[];
  hasStory: boolean;
  sourcePath?: string;
}

/**
 * Full manifest structure matching Studio's UIPackageManifest type.
 */
export interface StudioManifest {
  manifestVersion: string;
  setSlug: string;
  generatedAt: string;
  tokensHash: string;
  tokens: {
    colors: TokenInfo[];
    typography: TypographyTokenInfo[];
    spacing: TokenInfo[];
    radius: TokenInfo[];
    shadows: TokenInfo[];
    borders: BorderTokenInfo[];
    zIndex: ZIndexTokenInfo[];
    motion: MotionTokenInfo[];
  };
  components: ComponentInfo[];
  storybook: {
    url?: string;
    recommendedLinks: Array<{ title: string; href: string }>;
  };
  docs: {
    readmeMarkdown?: string;
    designSystemMarkdown?: string;
  };
  counts: {
    components: number;
    stories: number;
    tokens: number;
  };
  groupings: string[];
}

/**
 * Extract tokens from locked style guide into manifest format.
 */
function extractTokens(lockedTokens: StyleGuideLocked): StudioManifest["tokens"] {
  const tokens = lockedTokens.tokens;

  // Colors
  const colors: TokenInfo[] = tokens.colors.map((c) => ({
    name: c.cssVar.replace("--color-", ""),
    cssVar: c.cssVar,
    value: c.value,
    category: c.role?.split("-")[0] || "general",
    role: c.role,
  }));

  // Typography
  const typography: TypographyTokenInfo[] = tokens.typography.map((t) => ({
    name: t.cssVar.replace("--font-", ""),
    cssVar: t.cssVar,
    fontSize: t.fontSize,
    fontWeight: t.fontWeight,
    lineHeight: t.lineHeight,
  }));

  // Spacing
  const spacing: TokenInfo[] = tokens.spacing.map((s) => ({
    name: s.cssVar.replace("--space-", ""),
    cssVar: s.cssVar,
    value: s.value,
  }));

  // Radius
  const radius: TokenInfo[] = tokens.radius.map((r) => ({
    name: r.cssVar.replace("--radius-", ""),
    cssVar: r.cssVar,
    value: r.value,
  }));

  // Shadows
  const shadows: TokenInfo[] = tokens.shadows.map((s) => ({
    name: s.cssVar.replace("--shadow-", ""),
    cssVar: s.cssVar,
    value: s.value,
  }));

  // Borders
  const borders: BorderTokenInfo[] = (tokens.borders || []).map((b) => ({
    name: b.cssVar.replace("--border-", ""),
    cssVar: b.cssVar,
    width: b.width,
    style: b.style,
    color: b.color,
  }));

  // Z-index
  const zIndex: ZIndexTokenInfo[] = (tokens.zIndex || []).map((z) => ({
    name: z.cssVar.replace("--z-", ""),
    cssVar: z.cssVar,
    value: z.value,
  }));

  // Motion
  const motion: MotionTokenInfo[] = (tokens.motion || []).map((m) => ({
    name: m.cssVar.replace("--motion-", ""),
    cssVar: m.cssVar,
    duration: m.duration,
    easing: m.easing,
  }));

  return {
    colors,
    typography,
    spacing,
    radius,
    shadows,
    borders,
    zIndex,
    motion,
  };
}

/**
 * Extract component info from state and crop analyses.
 */
function extractComponents(
  setSlug: string,
  outputDir: string,
  state: CodegenState,
  cropAnalyses: CropAnalysis[]
): ComponentInfo[] {
  const components: ComponentInfo[] = [];
  const completedNames = getCompletedComponents(state);

  // Create a map of crop analyses by component name
  const cropMap = new Map<string, CropAnalysis>();
  for (const crop of cropAnalyses) {
    if (crop.suggestedComponentName) {
      cropMap.set(crop.suggestedComponentName, crop);
    }
  }

  for (const name of completedNames) {
    const crop = cropMap.get(name);

    // Determine the group/category
    const group = crop?.category || inferGroup(name, state);

    // Build component info
    const component: ComponentInfo = {
      name,
      group,
      description: crop?.description,
      importPath: `@boxybop/ui-${setSlug}/${name}`,
      storyIds: [`${group.toLowerCase()}-${name.toLowerCase()}--default`],
      sourceFiles: [`components/${name}/${name}.tsx`],
      hasStory: true, // All our components have stories
      sourcePath: `components/${name}/${name}.tsx`,
    };

    // Extract props if we have a crop analysis
    if (crop) {
      // Infer props from elements and variants
      const props: string[] = [];

      // Add variant props
      if (crop.variants.length > 0) {
        props.push("variant");
      }

      // Add state props
      if (crop.states.includes("disabled")) {
        props.push("disabled");
      }
      if (crop.states.includes("loading")) {
        props.push("loading");
      }

      // Add common props based on element types
      // Check if any element might contain text (buttons, badges, etc.)
      const hasText = crop.elements.some((e) =>
        ["button", "badge", "card", "container"].includes(e.type)
      );
      if (hasText) {
        props.push("children");
      }

      const hasIcon = crop.elements.some((e) => e.type === "icon");
      if (hasIcon) {
        props.push("icon");
      }

      component.props = props;
    }

    components.push(component);
  }

  // Sort by group then name
  components.sort((a, b) => {
    const groupCompare = a.group.localeCompare(b.group);
    if (groupCompare !== 0) return groupCompare;
    return a.name.localeCompare(b.name);
  });

  return components;
}

/**
 * Infer group from component name or state.
 */
function inferGroup(name: string, state: CodegenState): string {
  // Check primitives
  if (state.phases.primitives && name in state.phases.primitives) {
    return "Primitives";
  }

  // Check utilities
  if (state.phases.utilities && name in state.phases.utilities) {
    return "Utilities";
  }

  // Check inferred
  if (state.phases.inferred && name in state.phases.inferred) {
    return "Composed";
  }

  // Infer from name patterns
  const lowerName = name.toLowerCase();

  if (lowerName.includes("button")) return "Actions";
  if (lowerName.includes("input") || lowerName.includes("field")) return "Forms";
  if (lowerName.includes("card")) return "Layout";
  if (lowerName.includes("modal") || lowerName.includes("dialog")) return "Overlays";
  if (lowerName.includes("nav") || lowerName.includes("menu")) return "Navigation";
  if (lowerName.includes("table") || lowerName.includes("list")) return "Data Display";
  if (lowerName.includes("badge") || lowerName.includes("tag")) return "Status";
  if (lowerName.includes("icon")) return "Icons";

  return "Components";
}

/**
 * Read optional documentation files.
 */
async function readDocs(outputDir: string): Promise<StudioManifest["docs"]> {
  const docs: StudioManifest["docs"] = {};

  // Try to read README.md
  try {
    const readmePath = path.join(outputDir, "README.md");
    docs.readmeMarkdown = await fs.readFile(readmePath, "utf-8");
  } catch {
    // No README
  }

  // Try to read DESIGN_SYSTEM.md
  try {
    const designPath = path.join(outputDir, "DESIGN_SYSTEM.md");
    docs.designSystemMarkdown = await fs.readFile(designPath, "utf-8");
  } catch {
    // No design doc
  }

  return docs;
}

/**
 * Generate the studio.manifest.json file.
 */
export async function generateManifest(
  outputDir: string,
  setSlug: string,
  lockedTokens: StyleGuideLocked,
  state: CodegenState,
  cropAnalyses: CropAnalysis[]
): Promise<string> {
  // Extract all data
  const tokens = extractTokens(lockedTokens);
  const components = extractComponents(setSlug, outputDir, state, cropAnalyses);
  const docs = await readDocs(outputDir);

  // Calculate counts
  const tokenCount =
    tokens.colors.length +
    tokens.typography.length +
    tokens.spacing.length +
    tokens.radius.length +
    tokens.shadows.length +
    tokens.borders.length +
    tokens.zIndex.length +
    tokens.motion.length;

  const storyCount = components.filter((c) => c.hasStory).length;

  // Get unique groupings
  const groupings = [...new Set(components.map((c) => c.group))].sort();

  // Build manifest
  const manifest: StudioManifest = {
    manifestVersion: "1.0.0",
    setSlug,
    generatedAt: new Date().toISOString(),
    tokensHash: lockedTokens.tokensHash,
    tokens,
    components,
    storybook: {
      url: "http://localhost:6006",
      recommendedLinks: [
        { title: "All Stories", href: "/" },
        { title: "Primitives", href: "/?path=/story/primitives" },
        { title: "Forms", href: "/?path=/story/forms" },
        { title: "Layout", href: "/?path=/story/layout" },
      ],
    },
    docs,
    counts: {
      components: components.length,
      stories: storyCount,
      tokens: tokenCount,
    },
    groupings,
  };

  // Write manifest
  const manifestPath = path.join(outputDir, "studio.manifest.json");
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`[Manifest] Generated studio.manifest.json`);
  console.log(`[Manifest] ${components.length} components, ${tokenCount} tokens, ${storyCount} stories`);

  return manifestPath;
}

/**
 * Load an existing manifest.
 */
export async function loadManifest(outputDir: string): Promise<StudioManifest | null> {
  try {
    const manifestPath = path.join(outputDir, "studio.manifest.json");
    const content = await fs.readFile(manifestPath, "utf-8");
    return JSON.parse(content) as StudioManifest;
  } catch {
    return null;
  }
}
