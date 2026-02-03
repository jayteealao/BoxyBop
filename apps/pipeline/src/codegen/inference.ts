/**
 * Component Inference Engine.
 *
 * Infers additional components from detected components based on:
 * - Composition patterns (Label + Input → FormField)
 * - Repeated patterns (multiple Buttons → ButtonGroup)
 * - Structural patterns (Card → CardHeader, CardContent, CardFooter)
 */

import type { CropAnalysis, StyleGuideLocked } from "@boxybop/ir";
import type { InferredComponent } from "./types.js";

/**
 * Infer components from detected components and locked tokens.
 */
export function inferComponents(
  detectedComponents: CropAnalysis[],
  lockedTokens: StyleGuideLocked
): InferredComponent[] {
  const inferred: InferredComponent[] = [];
  const detected = new Set(
    detectedComponents
      .map((c) => c.suggestedComponentName)
      .filter(Boolean) as string[]
  );

  // Helper to get tokens from a detected component
  const getTokensForComponent = (name: string): string[] => {
    const comp = detectedComponents.find(
      (c) => c.suggestedComponentName === name
    );
    if (!comp) return [];
    return [
      ...comp.colorTokensUsed.map((t) => t.cssVar),
      ...comp.typographyTokensUsed.map((t) => t.cssVar),
      ...comp.spacingTokensUsed.map((t) => t.cssVar),
      ...comp.radiusTokensUsed.map((t) => t.cssVar),
      ...comp.shadowTokensUsed.map((t) => t.cssVar),
    ];
  };

  // Helper to merge token refs from multiple components
  const mergeTokenRefs = (components: string[]): string[] => {
    const refs = new Set<string>();
    for (const name of components) {
      for (const token of getTokensForComponent(name)) {
        refs.add(token);
      }
    }
    // Add common spacing tokens
    for (const s of lockedTokens.tokens.spacing.slice(0, 4)) {
      refs.add(s.cssVar);
    }
    return Array.from(refs);
  };

  // ==========================================================================
  // Rule 1: Composition patterns
  // ==========================================================================

  // Label + Input → FormField
  const hasLabel = detected.has("Label") ||
    detectedComponents.some((c) =>
      c.category === "typography" &&
      c.suggestedComponentName?.toLowerCase().includes("label")
    );
  const hasInput = detected.has("Input") || detected.has("TextInput");

  if (hasInput) {
    inferred.push({
      name: "FormField",
      category: "form",
      inferredFrom: {
        rule: "composition",
        sourceComponents: hasLabel ? ["Label", "Input"] : ["Input"],
        confidence: hasLabel ? 0.95 : 0.8,
      },
      description:
        "Form field wrapper combining label, input, and optional helper/error text",
      styleDescription: `Vertical stack layout with consistent spacing. Label positioned above input using --space-2 gap. Optional helper text below input with --space-1 gap, styled with muted text color. Error state changes helper text and input border to danger color. Maintains form rhythm with --space-4 between adjacent FormFields.`,
      tokenRefs: mergeTokenRefs(["Label", "Input"]),
    });
  }

  // ==========================================================================
  // Rule 2: Card structure
  // ==========================================================================

  if (detected.has("Card")) {
    const cardTokens = getTokensForComponent("Card");

    inferred.push({
      name: "CardHeader",
      category: "data-display",
      inferredFrom: {
        rule: "card-structure",
        sourceComponents: ["Card"],
        confidence: 0.9,
      },
      description: "Header section of a card with title and optional description",
      styleDescription: `Top section of Card with padding matching Card's internal rhythm. Contains heading (--text-heading-3 or similar) and optional subtitle in muted color. Bottom border optional for visual separation.`,
      tokenRefs: [...cardTokens, ...lockedTokens.tokens.typography.slice(0, 2).map((t) => t.cssVar)],
    });

    inferred.push({
      name: "CardContent",
      category: "data-display",
      inferredFrom: {
        rule: "card-structure",
        sourceComponents: ["Card"],
        confidence: 0.9,
      },
      description: "Main content area of a card",
      styleDescription: `Primary content section with consistent padding. Inherits Card's spacing tokens. No additional visual styling - acts as content container.`,
      tokenRefs: cardTokens,
    });

    inferred.push({
      name: "CardFooter",
      category: "data-display",
      inferredFrom: {
        rule: "card-structure",
        sourceComponents: ["Card"],
        confidence: 0.85,
      },
      description: "Footer section of a card, typically for actions",
      styleDescription: `Bottom section for actions (buttons, links). Uses horizontal flex layout with --space-2 gap between items. Top border or background change for visual separation. Actions typically right-aligned.`,
      tokenRefs: [...cardTokens, ...lockedTokens.tokens.spacing.slice(0, 3).map((s) => s.cssVar)],
    });
  }

  // ==========================================================================
  // Rule 3: Repeated patterns
  // ==========================================================================

  // Multiple Buttons → ButtonGroup
  const buttonCount = detectedComponents.filter(
    (c) => c.suggestedComponentName === "Button"
  ).length;

  if (buttonCount >= 1 || detected.has("Button")) {
    inferred.push({
      name: "ButtonGroup",
      category: "form",
      inferredFrom: {
        rule: "pattern",
        sourceComponents: ["Button"],
        confidence: 0.85,
      },
      description: "Horizontal group of related buttons with connected styling",
      styleDescription: `Horizontal flex container grouping multiple buttons. Gap of --space-1 or --space-2 between buttons. First button keeps left radius, last keeps right radius, middle buttons have no horizontal radius for seamless connection. Border collapse between adjacent buttons.`,
      tokenRefs: [...getTokensForComponent("Button"), ...lockedTokens.tokens.spacing.slice(0, 2).map((s) => s.cssVar)],
    });
  }

  // Input + Button → InputGroup
  if (hasInput && detected.has("Button")) {
    inferred.push({
      name: "InputGroup",
      category: "form",
      inferredFrom: {
        rule: "pattern",
        sourceComponents: ["Input", "Button"],
        confidence: 0.85,
      },
      description: "Input with attached button or addon",
      styleDescription: `Horizontal flex combining Input with Button or icon addon. Input takes flex-1, button/addon has fixed width. Shared border radius - input has right radius removed, button has left radius removed for seamless connection. Focus states coordinate across both elements.`,
      tokenRefs: mergeTokenRefs(["Input", "Button"]),
    });
  }

  // ==========================================================================
  // Rule 4: Navigation patterns
  // ==========================================================================

  if (detected.has("Tabs") || detected.has("Tab")) {
    inferred.push({
      name: "TabsList",
      category: "navigation",
      inferredFrom: {
        rule: "composition",
        sourceComponents: ["Tabs"],
        confidence: 0.9,
      },
      description: "Container for tab triggers",
      styleDescription: `Horizontal flex container for Tab items. Background slightly muted to create visual container. Padding creates consistent spacing around tabs. Typically has subtle border or background distinction.`,
      tokenRefs: mergeTokenRefs(["Tabs"]),
    });

    inferred.push({
      name: "TabsTrigger",
      category: "navigation",
      inferredFrom: {
        rule: "composition",
        sourceComponents: ["Tabs"],
        confidence: 0.9,
      },
      description: "Individual tab trigger button",
      styleDescription: `Interactive tab button. Default state has muted styling. Active state shows with background change or bottom border indicator. Hover state provides subtle feedback. Focus ring for accessibility.`,
      tokenRefs: mergeTokenRefs(["Tabs"]),
    });

    inferred.push({
      name: "TabsContent",
      category: "navigation",
      inferredFrom: {
        rule: "composition",
        sourceComponents: ["Tabs"],
        confidence: 0.9,
      },
      description: "Content panel for a tab",
      styleDescription: `Content area that shows when corresponding tab is active. Consistent padding matching overall spacing rhythm. Smooth transition when switching between tabs.`,
      tokenRefs: mergeTokenRefs(["Tabs"]),
    });
  }

  // ==========================================================================
  // Rule 5: Modal/Dialog structure
  // ==========================================================================

  if (detected.has("Modal") || detected.has("Dialog")) {
    const modalTokens = getTokensForComponent("Modal") || getTokensForComponent("Dialog");

    inferred.push({
      name: "DialogHeader",
      category: "overlay",
      inferredFrom: {
        rule: "composition",
        sourceComponents: ["Modal"],
        confidence: 0.9,
      },
      description: "Header section of a dialog with title",
      styleDescription: `Top section with title and optional close button. Title uses heading typography. Close button positioned top-right. Optional bottom border for separation.`,
      tokenRefs: modalTokens,
    });

    inferred.push({
      name: "DialogContent",
      category: "overlay",
      inferredFrom: {
        rule: "composition",
        sourceComponents: ["Modal"],
        confidence: 0.9,
      },
      description: "Main content area of a dialog",
      styleDescription: `Scrollable content area with consistent padding. Flexible height to accommodate various content lengths.`,
      tokenRefs: modalTokens,
    });

    inferred.push({
      name: "DialogFooter",
      category: "overlay",
      inferredFrom: {
        rule: "composition",
        sourceComponents: ["Modal"],
        confidence: 0.9,
      },
      description: "Footer section with dialog actions",
      styleDescription: `Bottom section for action buttons. Horizontal flex with gap between buttons. Cancel on left (or secondary), confirm on right (primary). Top border optional.`,
      tokenRefs: modalTokens,
    });
  }

  // ==========================================================================
  // Rule 6: Alert structure
  // ==========================================================================

  if (detected.has("Alert") || detected.has("Toast")) {
    const alertTokens = getTokensForComponent("Alert") || getTokensForComponent("Toast");

    inferred.push({
      name: "AlertTitle",
      category: "feedback",
      inferredFrom: {
        rule: "composition",
        sourceComponents: ["Alert"],
        confidence: 0.9,
      },
      description: "Title text for an alert",
      styleDescription: `Bold or semi-bold text for alert heading. Inherits color from alert variant (success, warning, danger, info). Tight spacing below for description.`,
      tokenRefs: alertTokens,
    });

    inferred.push({
      name: "AlertDescription",
      category: "feedback",
      inferredFrom: {
        rule: "composition",
        sourceComponents: ["Alert"],
        confidence: 0.9,
      },
      description: "Description text for an alert",
      styleDescription: `Body text providing alert details. Slightly muted from title but still readable. Wraps naturally for longer content.`,
      tokenRefs: alertTokens,
    });
  }

  // ==========================================================================
  // Rule 7: List structure
  // ==========================================================================

  if (detected.has("List")) {
    const listTokens = getTokensForComponent("List");

    inferred.push({
      name: "ListItem",
      category: "data-display",
      inferredFrom: {
        rule: "composition",
        sourceComponents: ["List"],
        confidence: 0.9,
      },
      description: "Individual item in a list",
      styleDescription: `Flex row with consistent padding. Optional leading icon/avatar and trailing action. Hover state for interactive lists. Divider between items using subtle border.`,
      tokenRefs: listTokens,
    });
  }

  // ==========================================================================
  // Rule 8: Select/Dropdown structure
  // ==========================================================================

  if (detected.has("Select") || detected.has("Dropdown")) {
    const selectTokens = getTokensForComponent("Select") || getTokensForComponent("Dropdown");

    inferred.push({
      name: "SelectTrigger",
      category: "form",
      inferredFrom: {
        rule: "composition",
        sourceComponents: ["Select"],
        confidence: 0.9,
      },
      description: "Trigger button for select dropdown",
      styleDescription: `Button-like trigger showing current selection. Input-like styling with border. Chevron icon on right indicating dropdown. Focus and hover states matching Input.`,
      tokenRefs: selectTokens,
    });

    inferred.push({
      name: "SelectContent",
      category: "form",
      inferredFrom: {
        rule: "composition",
        sourceComponents: ["Select"],
        confidence: 0.9,
      },
      description: "Dropdown content container for select options",
      styleDescription: `Floating dropdown panel with shadow for elevation. Background matches surface color. Border and radius consistent with design system. Max height with scroll for many options.`,
      tokenRefs: selectTokens,
    });

    inferred.push({
      name: "SelectItem",
      category: "form",
      inferredFrom: {
        rule: "composition",
        sourceComponents: ["Select"],
        confidence: 0.9,
      },
      description: "Individual option in a select dropdown",
      styleDescription: `Clickable option row with padding. Hover state highlights option. Selected state shows checkmark or background change. Keyboard navigation support.`,
      tokenRefs: selectTokens,
    });
  }

  return inferred;
}

/**
 * Get generation order respecting dependencies.
 * Detected components first (no cross-deps), then inferred (sorted by deps).
 */
export function getGenerationOrder(
  detectedNames: string[],
  inferred: InferredComponent[]
): { name: string; type: "detected" | "inferred" }[] {
  const order: { name: string; type: "detected" | "inferred" }[] = [];
  const generated = new Set<string>();

  // Phase 1: All detected (sorted alphabetically, no cross-deps)
  const sortedDetected = [...detectedNames].sort();
  for (const name of sortedDetected) {
    order.push({ name, type: "detected" });
    generated.add(name);
  }

  // Phase 2: Inferred (topological sort by deps)
  const inferredQueue = [...inferred];
  let maxIterations = inferredQueue.length * 2; // Prevent infinite loops

  while (inferredQueue.length > 0 && maxIterations > 0) {
    maxIterations--;

    // Find component whose deps are all satisfied
    const readyIndex = inferredQueue.findIndex((c) =>
      c.inferredFrom.sourceComponents.every((dep) => generated.has(dep))
    );

    if (readyIndex !== -1) {
      const next = inferredQueue.splice(readyIndex, 1)[0];
      order.push({ name: next.name, type: "inferred" });
      generated.add(next.name);
    } else {
      // No ready components - take first one (may have missing deps)
      const next = inferredQueue.shift()!;
      order.push({ name: next.name, type: "inferred" });
      generated.add(next.name);
    }
  }

  return order;
}
