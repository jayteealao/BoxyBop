/**
 * API client for Studio <-> Pipeline communication.
 */

import { z } from "zod";

// =============================================================================
// Schemas
// =============================================================================

export const UIPackageSchema = z.object({
  setSlug: z.string(),
  packagePath: z.string(),
  storybookUrl: z.string().optional(),
  generatedAt: z.string(),
  tokensHash: z.string(),
  counts: z.object({
    components: z.number(),
    stories: z.number(),
    tokens: z.number(),
  }),
  groupings: z.array(z.string()),
});

export type UIPackage = z.infer<typeof UIPackageSchema>;

export const TokenSummarySchema = z.object({
  colors: z.array(
    z.object({
      name: z.string(),
      cssVar: z.string(),
      value: z.string(),
      category: z.string().optional(),
      role: z.string().optional(),
    })
  ),
  typography: z.array(
    z.object({
      name: z.string(),
      cssVar: z.string(),
      fontSize: z.string(),
      fontWeight: z.union([z.string(), z.number()]),
      lineHeight: z.string().optional(),
    })
  ),
  spacing: z.array(
    z.object({
      name: z.string(),
      cssVar: z.string(),
      value: z.string(),
    })
  ),
  radius: z.array(
    z.object({
      name: z.string(),
      cssVar: z.string(),
      value: z.string(),
    })
  ),
  shadows: z.array(
    z.object({
      name: z.string(),
      cssVar: z.string(),
      value: z.string(),
    })
  ),
  borders: z.array(
    z.object({
      name: z.string(),
      cssVar: z.string(),
      width: z.string(),
      style: z.string(),
      color: z.string().optional(),
    })
  ),
  zIndex: z.array(
    z.object({
      name: z.string(),
      cssVar: z.string(),
      value: z.number(),
    })
  ),
  motion: z.array(
    z.object({
      name: z.string(),
      cssVar: z.string(),
      duration: z.string(),
      easing: z.string().optional(),
    })
  ),
});

export type TokenSummary = z.infer<typeof TokenSummarySchema>;

export const ComponentInfoSchema = z.object({
  name: z.string(),
  group: z.string(),
  description: z.string().optional(),
  importPath: z.string(),
  storyIds: z.array(z.string()).optional(),
  sourceFiles: z.array(z.string()).optional(),
  props: z.array(z.string()).optional(),
  hasStory: z.boolean().optional(),
  sourcePath: z.string().optional(),
});

export type ComponentInfo = z.infer<typeof ComponentInfoSchema>;

export const UIPackageManifestSchema = z.object({
  manifestVersion: z.string(),
  setSlug: z.string(),
  generatedAt: z.string(),
  tokensHash: z.string(),
  tokens: TokenSummarySchema,
  components: z.array(ComponentInfoSchema),
  storybook: z.object({
    url: z.string().optional(),
    recommendedLinks: z.array(
      z.object({
        title: z.string(),
        href: z.string(),
      })
    ),
  }),
  docs: z.object({
    readmeMarkdown: z.string().optional(),
    designSystemMarkdown: z.string().optional(),
  }),
});

export type UIPackageManifest = z.infer<typeof UIPackageManifestSchema>;

// =============================================================================
// API Functions
// =============================================================================

export async function fetchUIPackages(): Promise<UIPackage[]> {
  const response = await fetch("/api/ui-packages");
  if (!response.ok) {
    throw new Error(`Failed to fetch UI packages: ${response.status}`);
  }
  const data = await response.json();
  return z.array(UIPackageSchema).parse(data);
}

export async function fetchUIPackageManifest(
  setSlug: string
): Promise<UIPackageManifest> {
  const response = await fetch(`/api/ui-packages/${setSlug}/manifest`);
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Package not found: ${setSlug}`);
    }
    throw new Error(`Failed to fetch manifest: ${response.status}`);
  }
  const data = await response.json();
  return UIPackageManifestSchema.parse(data);
}
