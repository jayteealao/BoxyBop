/**
 * Registry Template Generator.
 *
 * Generates the master registry template from the component manifest.
 * This template is copied and filled when creating a new UI package.
 */

import {
  ALL_COMPONENTS,
  REQUIRED_COMPONENTS,
  OPTIONAL_COMPONENTS,
  type ComponentDefinition,
} from "./components.js";
import {
  type Registry,
  type RegistryItem,
  type RegistryMetadata,
  TEMPLATE_PLACEHOLDERS,
} from "./schema.js";

// =============================================================================
// Template Generation
// =============================================================================

/**
 * Convert a ComponentDefinition to a RegistryItem.
 */
function componentToRegistryItem(component: ComponentDefinition): RegistryItem {
  const item: RegistryItem = {
    name: component.name,
    type: component.source === "primitive" ? "registry:ui" : "registry:component",
    title: component.title,
    description: component.description,
    categories: [component.category, ...(component.categories || [])],
    registryDependencies: component.dependencies,
    files: [
      {
        path: `components/${pascalCase(component.name)}/${pascalCase(component.name)}.tsx`,
        type: "registry:component",
      },
      {
        path: `components/${pascalCase(component.name)}/${pascalCase(component.name)}.stories.tsx`,
        type: "registry:file",
      },
    ],
    meta: {
      source: component.source,
      required: component.required,
      category: component.category,
      inferredFrom: component.inferredFrom,
      variants: component.variants,
      states: component.states,
    },
  };

  // Special handling for tokens
  if (component.name === "tokens") {
    item.type = "registry:style";
    item.files = [
      { path: "tokens.css", type: "registry:style" },
      { path: "lib/tokens.ts", type: "registry:lib" },
    ];
  }

  // Special handling for icons
  if (component.name === "icons") {
    item.type = "registry:lib";
    item.files = [
      { path: "lib/icons.tsx", type: "registry:lib" },
    ];
  }

  return item;
}

/**
 * Convert kebab-case to PascalCase.
 */
function pascalCase(str: string): string {
  return str
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}

/**
 * Generate the master registry template.
 */
export function generateMasterTemplate(): Registry {
  const items: RegistryItem[] = ALL_COMPONENTS.map(componentToRegistryItem);

  return {
    $schema: "https://ui.shadcn.com/schema/registry.json",
    name: `ui-${TEMPLATE_PLACEHOLDERS.SET_SLUG}`,
    homepage: TEMPLATE_PLACEHOLDERS.HOMEPAGE,
    items,
    metadata: {
      setSlug: TEMPLATE_PLACEHOLDERS.SET_SLUG,
      styleRunId: TEMPLATE_PLACEHOLDERS.STYLE_RUN_ID,
      createdAt: TEMPLATE_PLACEHOLDERS.CREATED_AT,
      inputChecksum: TEMPLATE_PLACEHOLDERS.INPUT_CHECKSUM,
      generatorVersion: TEMPLATE_PLACEHOLDERS.GENERATOR_VERSION,
    },
  };
}

/**
 * Generate a registry with only required components.
 */
export function generateRequiredTemplate(): Registry {
  const items: RegistryItem[] = REQUIRED_COMPONENTS.map(componentToRegistryItem);

  return {
    $schema: "https://ui.shadcn.com/schema/registry.json",
    name: `ui-${TEMPLATE_PLACEHOLDERS.SET_SLUG}`,
    homepage: TEMPLATE_PLACEHOLDERS.HOMEPAGE,
    items,
    metadata: {
      setSlug: TEMPLATE_PLACEHOLDERS.SET_SLUG,
      styleRunId: TEMPLATE_PLACEHOLDERS.STYLE_RUN_ID,
      createdAt: TEMPLATE_PLACEHOLDERS.CREATED_AT,
      inputChecksum: TEMPLATE_PLACEHOLDERS.INPUT_CHECKSUM,
      generatorVersion: TEMPLATE_PLACEHOLDERS.GENERATOR_VERSION,
    },
  };
}

/**
 * Fill template placeholders with actual values.
 */
export function fillTemplatePlaceholders(
  template: Registry,
  values: {
    setSlug: string;
    styleRunId: string;
    createdAt?: string;
    inputChecksum: string;
    homepage?: string;
    generatorVersion?: string;
  }
): Registry {
  const json = JSON.stringify(template);
  const filled = json
    .replace(new RegExp(TEMPLATE_PLACEHOLDERS.SET_SLUG, "g"), values.setSlug)
    .replace(new RegExp(TEMPLATE_PLACEHOLDERS.STYLE_RUN_ID, "g"), values.styleRunId)
    .replace(
      new RegExp(TEMPLATE_PLACEHOLDERS.CREATED_AT, "g"),
      values.createdAt || new Date().toISOString()
    )
    .replace(new RegExp(TEMPLATE_PLACEHOLDERS.INPUT_CHECKSUM, "g"), values.inputChecksum)
    .replace(
      new RegExp(TEMPLATE_PLACEHOLDERS.HOMEPAGE, "g"),
      values.homepage || `https://ui.boxybop.dev/${values.setSlug}`
    )
    .replace(
      new RegExp(TEMPLATE_PLACEHOLDERS.GENERATOR_VERSION, "g"),
      values.generatorVersion || "1.0.0"
    );

  return JSON.parse(filled);
}

/**
 * Add optional components to a registry.
 */
export function addOptionalComponents(
  registry: Registry,
  categories: string[]
): Registry {
  const optionalItems = OPTIONAL_COMPONENTS.filter((c) =>
    categories.includes(c.category)
  ).map(componentToRegistryItem);

  return {
    ...registry,
    items: [...registry.items, ...optionalItems],
  };
}

/**
 * Update a registry item with crop analysis data.
 */
export function updateItemWithCropAnalysis(
  item: RegistryItem,
  analysis: {
    cropId: string;
    styleDescription?: string;
    tokenRefs?: {
      colors?: string[];
      typography?: string[];
      spacing?: string[];
      radius?: string[];
      shadows?: string[];
    };
    variants?: string[];
    states?: string[];
  }
): RegistryItem {
  return {
    ...item,
    meta: {
      ...item.meta,
      source: item.meta?.source || "detected",
      required: item.meta?.required ?? true,
      category: item.meta?.category || "data-display",
      cropId: analysis.cropId,
      styleDescription: analysis.styleDescription,
      tokenRefs: analysis.tokenRefs,
      variants: analysis.variants || item.meta?.variants,
      states: analysis.states || item.meta?.states,
    },
  };
}

/**
 * Get the master template as a JSON string.
 */
export function getMasterTemplateJson(pretty = true): string {
  const template = generateMasterTemplate();
  return JSON.stringify(template, null, pretty ? 2 : 0);
}

/**
 * Get component count summary.
 */
export function getTemplateSummary(): {
  total: number;
  required: number;
  optional: number;
  byCategory: Record<string, number>;
  bySource: Record<string, number>;
} {
  const byCategory: Record<string, number> = {};
  const bySource: Record<string, number> = {};

  for (const component of ALL_COMPONENTS) {
    byCategory[component.category] = (byCategory[component.category] || 0) + 1;
    bySource[component.source] = (bySource[component.source] || 0) + 1;
  }

  return {
    total: ALL_COMPONENTS.length,
    required: REQUIRED_COMPONENTS.length,
    optional: OPTIONAL_COMPONENTS.length,
    byCategory,
    bySource,
  };
}
