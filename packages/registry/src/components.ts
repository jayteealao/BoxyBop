/**
 * Component Manifest - Master list of all UI components.
 *
 * This is the single source of truth for what components exist in a BoxyBop UI package.
 * Components are organized by category and include metadata for generation.
 */

// =============================================================================
// Types
// =============================================================================

export type ComponentCategory =
  | "foundations"
  | "layout"
  | "typography"
  | "navigation"
  | "forms"
  | "buttons"
  | "data-display"
  | "feedback"
  | "overlays"
  | "media"
  | "utility"
  | "advanced";

export type ComponentSource =
  | "primitive"    // Always generated from templates
  | "detected"     // From screenshot analysis
  | "inferred"     // Derived from detected patterns
  | "template";    // Generated from static templates

export interface ComponentDefinition {
  /** Kebab-case name (used as registry item name) */
  name: string;
  /** Human-readable title */
  title: string;
  /** Description of the component */
  description: string;
  /** Primary category */
  category: ComponentCategory;
  /** Additional categories for cross-referencing */
  categories?: ComponentCategory[];
  /** How this component is generated */
  source: ComponentSource;
  /** Whether this component is required (vs optional) */
  required: boolean;
  /** Components this depends on */
  dependencies?: string[];
  /** For inferred components: what triggers inference */
  inferredFrom?: {
    rule: "composition" | "pattern" | "card-structure" | "always";
    triggers: string[];
  };
  /** Common variants */
  variants?: string[];
  /** Common states */
  states?: string[];
}

export interface CategoryDefinition {
  name: ComponentCategory;
  title: string;
  description: string;
  required: boolean;
  components: ComponentDefinition[];
}

// =============================================================================
// Foundations
// =============================================================================

const FOUNDATIONS: ComponentDefinition[] = [
  {
    name: "tokens",
    title: "Design Tokens",
    description: "Color, spacing, typography, radius, elevation tokens",
    category: "foundations",
    source: "primitive",
    required: true,
  },
  {
    name: "icons",
    title: "Icons",
    description: "Icon system and icon components",
    category: "foundations",
    source: "template",
    required: true,
  },
];

// =============================================================================
// Layout Primitives
// =============================================================================

const LAYOUT_PRIMITIVES: ComponentDefinition[] = [
  {
    name: "box",
    title: "Box",
    description: "Container with spacing, padding, and background support",
    category: "layout",
    source: "primitive",
    required: true,
    dependencies: ["tokens"],
  },
  {
    name: "stack",
    title: "Stack",
    description: "Vertical flex container with consistent gap spacing",
    category: "layout",
    source: "primitive",
    required: true,
    dependencies: ["tokens"],
  },
  {
    name: "flex",
    title: "Flex",
    description: "Flexible box container for horizontal and vertical layouts",
    category: "layout",
    source: "primitive",
    required: true,
    dependencies: ["tokens"],
  },
  {
    name: "grid",
    title: "Grid",
    description: "CSS Grid container for complex two-dimensional layouts",
    category: "layout",
    source: "primitive",
    required: true,
    dependencies: ["tokens"],
  },
  {
    name: "divider",
    title: "Divider",
    description: "Visual separator for content sections",
    category: "layout",
    source: "primitive",
    required: true,
    dependencies: ["tokens"],
  },
  {
    name: "separator",
    title: "Separator",
    description: "Semantic separator element (alias for divider)",
    category: "layout",
    source: "primitive",
    required: true,
    dependencies: ["divider"],
  },
  {
    name: "aspect-ratio",
    title: "Aspect Ratio",
    description: "Container that maintains a specified aspect ratio",
    category: "layout",
    source: "template",
    required: true,
    dependencies: ["box"],
  },
  {
    name: "scroll-area",
    title: "Scroll Area",
    description: "Custom scrollable area with styled scrollbars",
    category: "layout",
    source: "detected",
    required: true,
    dependencies: ["box"],
  },
  {
    name: "resizable",
    title: "Resizable",
    description: "Resizable panel layout with drag handles",
    category: "layout",
    source: "detected",
    required: true,
    dependencies: ["box"],
  },
];

// =============================================================================
// Typography
// =============================================================================

const TYPOGRAPHY: ComponentDefinition[] = [
  {
    name: "text",
    title: "Text",
    description: "Body text component with typography token support",
    category: "typography",
    source: "primitive",
    required: true,
    dependencies: ["tokens"],
  },
  {
    name: "heading",
    title: "Heading",
    description: "Heading component for h1-h6 with typography tokens",
    category: "typography",
    source: "primitive",
    required: true,
    dependencies: ["tokens"],
  },
  {
    name: "label",
    title: "Label",
    description: "Form label with accessibility support",
    category: "typography",
    categories: ["forms"],
    source: "detected",
    required: true,
    dependencies: ["tokens"],
  },
  {
    name: "code",
    title: "Code",
    description: "Inline and block code display",
    category: "typography",
    source: "template",
    required: true,
    dependencies: ["tokens"],
  },
  {
    name: "kbd",
    title: "Kbd",
    description: "Keyboard key indicator",
    category: "typography",
    source: "template",
    required: true,
    dependencies: ["tokens"],
  },
];

// =============================================================================
// Navigation
// =============================================================================

const NAVIGATION: ComponentDefinition[] = [
  {
    name: "app-bar",
    title: "App Bar",
    description: "Top navigation bar with branding and actions",
    category: "navigation",
    source: "detected",
    required: true,
    dependencies: ["box", "flex"],
  },
  {
    name: "sidebar",
    title: "Sidebar",
    description: "Side navigation panel with collapsible sections",
    category: "navigation",
    source: "detected",
    required: true,
    dependencies: ["box", "stack"],
  },
  {
    name: "navigation-rail",
    title: "Navigation Rail",
    description: "Compact vertical navigation for desktop",
    category: "navigation",
    source: "detected",
    required: true,
    dependencies: ["box", "stack"],
  },
  {
    name: "tabs",
    title: "Tabs",
    description: "Tabbed navigation container",
    category: "navigation",
    source: "detected",
    required: true,
    dependencies: ["box"],
  },
  {
    name: "tabs-list",
    title: "Tabs List",
    description: "Container for tab triggers",
    category: "navigation",
    source: "inferred",
    required: true,
    dependencies: ["tabs", "flex"],
    inferredFrom: { rule: "composition", triggers: ["tabs"] },
  },
  {
    name: "tabs-trigger",
    title: "Tabs Trigger",
    description: "Individual tab button",
    category: "navigation",
    source: "inferred",
    required: true,
    dependencies: ["tabs", "button"],
    inferredFrom: { rule: "composition", triggers: ["tabs"] },
  },
  {
    name: "tabs-content",
    title: "Tabs Content",
    description: "Content panel for a tab",
    category: "navigation",
    source: "inferred",
    required: true,
    dependencies: ["tabs", "box"],
    inferredFrom: { rule: "composition", triggers: ["tabs"] },
  },
  {
    name: "breadcrumb",
    title: "Breadcrumb",
    description: "Navigation breadcrumb trail",
    category: "navigation",
    source: "detected",
    required: true,
    dependencies: ["flex", "link"],
  },
  {
    name: "pagination",
    title: "Pagination",
    description: "Page navigation controls",
    category: "navigation",
    source: "detected",
    required: true,
    dependencies: ["flex", "button"],
  },
  {
    name: "stepper",
    title: "Stepper",
    description: "Multi-step wizard navigation",
    category: "navigation",
    source: "detected",
    required: true,
    dependencies: ["flex", "box"],
  },
  {
    name: "navigation-menu",
    title: "Navigation Menu",
    description: "Horizontal navigation with dropdowns",
    category: "navigation",
    source: "detected",
    required: true,
    dependencies: ["flex", "popover"],
  },
  {
    name: "menubar",
    title: "Menubar",
    description: "Application menu bar",
    category: "navigation",
    source: "detected",
    required: true,
    dependencies: ["flex", "dropdown-menu"],
  },
];

// =============================================================================
// Inputs & Forms
// =============================================================================

const FORMS: ComponentDefinition[] = [
  {
    name: "input",
    title: "Input",
    description: "Text input field",
    category: "forms",
    source: "detected",
    required: true,
    dependencies: ["tokens"],
    states: ["default", "hover", "focus", "disabled", "error"],
  },
  {
    name: "textarea",
    title: "Textarea",
    description: "Multi-line text input",
    category: "forms",
    source: "detected",
    required: true,
    dependencies: ["tokens"],
    states: ["default", "hover", "focus", "disabled", "error"],
  },
  {
    name: "password-input",
    title: "Password Input",
    description: "Password input with visibility toggle",
    category: "forms",
    source: "inferred",
    required: true,
    dependencies: ["input", "icon-button"],
    inferredFrom: { rule: "pattern", triggers: ["input"] },
  },
  {
    name: "number-input",
    title: "Number Input",
    description: "Numeric input with increment/decrement",
    category: "forms",
    source: "inferred",
    required: true,
    dependencies: ["input", "button"],
    inferredFrom: { rule: "pattern", triggers: ["input"] },
  },
  {
    name: "search-input",
    title: "Search Input",
    description: "Search input with icon and clear button",
    category: "forms",
    source: "inferred",
    required: true,
    dependencies: ["input", "icon-button"],
    inferredFrom: { rule: "pattern", triggers: ["input"] },
  },
  {
    name: "select",
    title: "Select",
    description: "Dropdown select component",
    category: "forms",
    source: "detected",
    required: true,
    dependencies: ["popover"],
    states: ["default", "hover", "focus", "disabled", "open"],
  },
  {
    name: "native-select",
    title: "Native Select",
    description: "Native browser select element with styling",
    category: "forms",
    source: "template",
    required: true,
    dependencies: ["tokens"],
  },
  {
    name: "multi-select",
    title: "Multi Select",
    description: "Select with multiple selection support",
    category: "forms",
    source: "inferred",
    required: true,
    dependencies: ["select", "badge"],
    inferredFrom: { rule: "pattern", triggers: ["select"] },
  },
  {
    name: "combobox",
    title: "Combobox",
    description: "Autocomplete input with dropdown",
    category: "forms",
    source: "detected",
    required: true,
    dependencies: ["input", "popover", "command"],
  },
  {
    name: "checkbox",
    title: "Checkbox",
    description: "Checkbox input with label",
    category: "forms",
    source: "detected",
    required: true,
    dependencies: ["tokens"],
    states: ["default", "hover", "focus", "checked", "indeterminate", "disabled"],
  },
  {
    name: "radio-group",
    title: "Radio Group",
    description: "Radio button group",
    category: "forms",
    source: "detected",
    required: true,
    dependencies: ["tokens"],
    states: ["default", "hover", "focus", "checked", "disabled"],
  },
  {
    name: "switch",
    title: "Switch",
    description: "Toggle switch",
    category: "forms",
    source: "detected",
    required: true,
    dependencies: ["tokens"],
    states: ["default", "hover", "focus", "checked", "disabled"],
  },
  {
    name: "slider",
    title: "Slider",
    description: "Range slider input",
    category: "forms",
    source: "detected",
    required: true,
    dependencies: ["tokens"],
    states: ["default", "hover", "focus", "disabled"],
  },
  {
    name: "date-picker",
    title: "Date Picker",
    description: "Date selection with calendar popup",
    category: "forms",
    source: "detected",
    required: true,
    dependencies: ["input", "popover", "calendar"],
  },
  {
    name: "time-picker",
    title: "Time Picker",
    description: "Time selection input",
    category: "forms",
    source: "detected",
    required: true,
    dependencies: ["input", "popover", "select"],
  },
  {
    name: "calendar",
    title: "Calendar",
    description: "Calendar grid for date selection",
    category: "forms",
    source: "detected",
    required: true,
    dependencies: ["grid", "button"],
  },
  {
    name: "file-upload",
    title: "File Upload",
    description: "File upload dropzone",
    category: "forms",
    source: "detected",
    required: true,
    dependencies: ["box", "button"],
    states: ["default", "hover", "dragging", "uploading", "error"],
  },
  {
    name: "rating",
    title: "Rating",
    description: "Star rating input",
    category: "forms",
    source: "detected",
    required: true,
    dependencies: ["flex"],
  },
  {
    name: "field",
    title: "Field",
    description: "Form field wrapper with label, input, and helper text",
    category: "forms",
    source: "inferred",
    required: true,
    dependencies: ["label", "stack"],
    inferredFrom: { rule: "composition", triggers: ["input", "label"] },
  },
  {
    name: "fieldset",
    title: "Fieldset",
    description: "Group of related form fields",
    category: "forms",
    source: "template",
    required: true,
    dependencies: ["stack"],
  },
  {
    name: "validation-message",
    title: "Validation Message",
    description: "Form validation error/success message",
    category: "forms",
    source: "inferred",
    required: true,
    dependencies: ["text"],
    inferredFrom: { rule: "pattern", triggers: ["input", "field"] },
  },
  {
    name: "helper-text",
    title: "Helper Text",
    description: "Form field helper text",
    category: "forms",
    source: "inferred",
    required: true,
    dependencies: ["text"],
    inferredFrom: { rule: "pattern", triggers: ["input", "field"] },
  },
  {
    name: "input-otp",
    title: "Input OTP",
    description: "One-time password input",
    category: "forms",
    source: "detected",
    required: true,
    dependencies: ["input", "flex"],
  },
  {
    name: "input-group",
    title: "Input Group",
    description: "Input with attached addons",
    category: "forms",
    source: "inferred",
    required: true,
    dependencies: ["input", "flex"],
    inferredFrom: { rule: "composition", triggers: ["input", "button"] },
  },
];

// =============================================================================
// Buttons & Actions
// =============================================================================

const BUTTONS: ComponentDefinition[] = [
  {
    name: "button",
    title: "Button",
    description: "Clickable action trigger",
    category: "buttons",
    source: "detected",
    required: true,
    dependencies: ["tokens"],
    variants: ["primary", "secondary", "destructive", "outline", "ghost", "link"],
    states: ["default", "hover", "active", "focus", "disabled", "loading"],
  },
  {
    name: "icon-button",
    title: "Icon Button",
    description: "Button with icon only",
    category: "buttons",
    source: "inferred",
    required: true,
    dependencies: ["button"],
    inferredFrom: { rule: "pattern", triggers: ["button"] },
  },
  {
    name: "button-group",
    title: "Button Group",
    description: "Group of related buttons",
    category: "buttons",
    source: "inferred",
    required: true,
    dependencies: ["button", "flex"],
    inferredFrom: { rule: "pattern", triggers: ["button"] },
  },
  {
    name: "fab",
    title: "Floating Action Button",
    description: "Floating action button for primary actions",
    category: "buttons",
    source: "detected",
    required: true,
    dependencies: ["button"],
  },
  {
    name: "split-button",
    title: "Split Button",
    description: "Button with dropdown for additional actions",
    category: "buttons",
    source: "inferred",
    required: true,
    dependencies: ["button", "dropdown-menu"],
    inferredFrom: { rule: "pattern", triggers: ["button", "dropdown-menu"] },
  },
  {
    name: "link",
    title: "Link",
    description: "Anchor/link component",
    category: "buttons",
    source: "template",
    required: true,
    dependencies: ["tokens"],
    states: ["default", "hover", "active", "focus", "visited"],
  },
  {
    name: "toggle",
    title: "Toggle",
    description: "Toggle button",
    category: "buttons",
    source: "detected",
    required: true,
    dependencies: ["button"],
    states: ["default", "hover", "pressed", "disabled"],
  },
  {
    name: "toggle-group",
    title: "Toggle Group",
    description: "Group of toggle buttons",
    category: "buttons",
    source: "inferred",
    required: true,
    dependencies: ["toggle", "flex"],
    inferredFrom: { rule: "pattern", triggers: ["toggle"] },
  },
];

// =============================================================================
// Data Display
// =============================================================================

const DATA_DISPLAY: ComponentDefinition[] = [
  {
    name: "table",
    title: "Table",
    description: "Data table component",
    category: "data-display",
    source: "detected",
    required: true,
    dependencies: ["tokens"],
  },
  {
    name: "data-table",
    title: "Data Table",
    description: "Advanced data table with sorting, filtering, pagination",
    category: "data-display",
    source: "detected",
    required: true,
    dependencies: ["table", "pagination", "input"],
  },
  {
    name: "list",
    title: "List",
    description: "List container",
    category: "data-display",
    source: "detected",
    required: true,
    dependencies: ["stack"],
  },
  {
    name: "list-item",
    title: "List Item",
    description: "Individual list item",
    category: "data-display",
    source: "inferred",
    required: true,
    dependencies: ["list", "flex"],
    inferredFrom: { rule: "composition", triggers: ["list"] },
  },
  {
    name: "item",
    title: "Item",
    description: "Generic item component",
    category: "data-display",
    source: "template",
    required: true,
    dependencies: ["box"],
  },
  {
    name: "card",
    title: "Card",
    description: "Content card container",
    category: "data-display",
    source: "detected",
    required: true,
    dependencies: ["box"],
  },
  {
    name: "card-header",
    title: "Card Header",
    description: "Card header section",
    category: "data-display",
    source: "inferred",
    required: true,
    dependencies: ["card", "flex"],
    inferredFrom: { rule: "card-structure", triggers: ["card"] },
  },
  {
    name: "card-content",
    title: "Card Content",
    description: "Card content section",
    category: "data-display",
    source: "inferred",
    required: true,
    dependencies: ["card", "box"],
    inferredFrom: { rule: "card-structure", triggers: ["card"] },
  },
  {
    name: "card-footer",
    title: "Card Footer",
    description: "Card footer section",
    category: "data-display",
    source: "inferred",
    required: true,
    dependencies: ["card", "flex"],
    inferredFrom: { rule: "card-structure", triggers: ["card"] },
  },
  {
    name: "avatar",
    title: "Avatar",
    description: "User avatar with image or initials fallback",
    category: "data-display",
    source: "detected",
    required: true,
    dependencies: ["box"],
  },
  {
    name: "badge",
    title: "Badge",
    description: "Status badge or counter",
    category: "data-display",
    source: "detected",
    required: true,
    dependencies: ["tokens"],
    variants: ["default", "secondary", "destructive", "outline"],
  },
  {
    name: "chip",
    title: "Chip",
    description: "Interactive chip/tag",
    category: "data-display",
    source: "detected",
    required: true,
    dependencies: ["tokens"],
  },
  {
    name: "tag",
    title: "Tag",
    description: "Tag label (alias for chip)",
    category: "data-display",
    source: "template",
    required: true,
    dependencies: ["chip"],
  },
  {
    name: "tooltip",
    title: "Tooltip",
    description: "Hover tooltip",
    category: "data-display",
    categories: ["overlays"],
    source: "detected",
    required: true,
    dependencies: ["portal"],
  },
  {
    name: "popover",
    title: "Popover",
    description: "Click-triggered popover",
    category: "data-display",
    categories: ["overlays"],
    source: "detected",
    required: true,
    dependencies: ["portal"],
  },
  {
    name: "hover-card",
    title: "Hover Card",
    description: "Rich content tooltip on hover",
    category: "data-display",
    source: "detected",
    required: true,
    dependencies: ["popover", "card"],
  },
  {
    name: "accordion",
    title: "Accordion",
    description: "Collapsible content sections",
    category: "data-display",
    source: "detected",
    required: true,
    dependencies: ["collapsible"],
  },
  {
    name: "collapsible",
    title: "Collapsible",
    description: "Single collapsible section",
    category: "data-display",
    source: "detected",
    required: true,
    dependencies: ["box"],
  },
  {
    name: "tree-view",
    title: "Tree View",
    description: "Hierarchical tree structure",
    category: "data-display",
    source: "detected",
    required: true,
    dependencies: ["collapsible", "stack"],
  },
  {
    name: "timeline",
    title: "Timeline",
    description: "Vertical timeline display",
    category: "data-display",
    source: "detected",
    required: true,
    dependencies: ["stack"],
  },
  {
    name: "stat",
    title: "Stat",
    description: "Statistic display with label and value",
    category: "data-display",
    source: "detected",
    required: true,
    dependencies: ["stack", "text", "heading"],
  },
  {
    name: "metric",
    title: "Metric",
    description: "Metric display (alias for stat)",
    category: "data-display",
    source: "template",
    required: true,
    dependencies: ["stat"],
  },
  {
    name: "progress",
    title: "Progress",
    description: "Progress bar",
    category: "data-display",
    source: "detected",
    required: true,
    dependencies: ["tokens"],
  },
  {
    name: "spinner",
    title: "Spinner",
    description: "Loading spinner",
    category: "data-display",
    source: "detected",
    required: true,
    dependencies: ["tokens"],
  },
  {
    name: "skeleton",
    title: "Skeleton",
    description: "Content loading placeholder",
    category: "data-display",
    source: "detected",
    required: true,
    dependencies: ["box"],
  },
  {
    name: "empty",
    title: "Empty",
    description: "Empty state placeholder",
    category: "data-display",
    source: "detected",
    required: true,
    dependencies: ["stack", "text"],
  },
  {
    name: "carousel",
    title: "Carousel",
    description: "Image/content carousel",
    category: "data-display",
    source: "detected",
    required: true,
    dependencies: ["box", "button"],
  },
  {
    name: "chart",
    title: "Chart",
    description: "Data visualization chart",
    category: "data-display",
    source: "detected",
    required: true,
    dependencies: ["box"],
  },
];

// =============================================================================
// Feedback & Status
// =============================================================================

const FEEDBACK: ComponentDefinition[] = [
  {
    name: "alert",
    title: "Alert",
    description: "Alert message box",
    category: "feedback",
    source: "detected",
    required: true,
    dependencies: ["box"],
    variants: ["default", "info", "success", "warning", "destructive"],
  },
  {
    name: "alert-dialog",
    title: "Alert Dialog",
    description: "Modal alert requiring user action",
    category: "feedback",
    source: "detected",
    required: true,
    dependencies: ["dialog"],
  },
  {
    name: "toast",
    title: "Toast",
    description: "Temporary notification toast",
    category: "feedback",
    source: "detected",
    required: true,
    dependencies: ["portal", "box"],
    variants: ["default", "success", "error", "warning", "info"],
  },
  {
    name: "sonner",
    title: "Sonner",
    description: "Toast notification system (sonner integration)",
    category: "feedback",
    source: "template",
    required: true,
    dependencies: ["toast"],
  },
  {
    name: "notification",
    title: "Notification",
    description: "Notification component",
    category: "feedback",
    source: "detected",
    required: true,
    dependencies: ["card", "flex"],
  },
  {
    name: "dialog",
    title: "Dialog",
    description: "Modal dialog",
    category: "feedback",
    categories: ["overlays"],
    source: "detected",
    required: true,
    dependencies: ["portal", "focus-trap"],
  },
  {
    name: "dialog-header",
    title: "Dialog Header",
    description: "Dialog header section",
    category: "feedback",
    source: "inferred",
    required: true,
    dependencies: ["dialog", "flex"],
    inferredFrom: { rule: "composition", triggers: ["dialog"] },
  },
  {
    name: "dialog-content",
    title: "Dialog Content",
    description: "Dialog content section",
    category: "feedback",
    source: "inferred",
    required: true,
    dependencies: ["dialog", "box"],
    inferredFrom: { rule: "composition", triggers: ["dialog"] },
  },
  {
    name: "dialog-footer",
    title: "Dialog Footer",
    description: "Dialog footer section",
    category: "feedback",
    source: "inferred",
    required: true,
    dependencies: ["dialog", "flex"],
    inferredFrom: { rule: "composition", triggers: ["dialog"] },
  },
  {
    name: "confirmation-dialog",
    title: "Confirmation Dialog",
    description: "Confirmation modal with yes/no actions",
    category: "feedback",
    source: "inferred",
    required: true,
    dependencies: ["alert-dialog", "button"],
    inferredFrom: { rule: "pattern", triggers: ["alert-dialog"] },
  },
  {
    name: "banner",
    title: "Banner",
    description: "Full-width announcement banner",
    category: "feedback",
    source: "detected",
    required: true,
    dependencies: ["flex", "box"],
  },
  {
    name: "inline-error",
    title: "Inline Error",
    description: "Inline error message",
    category: "feedback",
    source: "inferred",
    required: true,
    dependencies: ["text"],
    inferredFrom: { rule: "pattern", triggers: ["alert", "validation-message"] },
  },
  {
    name: "inline-warning",
    title: "Inline Warning",
    description: "Inline warning message",
    category: "feedback",
    source: "inferred",
    required: true,
    dependencies: ["text"],
    inferredFrom: { rule: "pattern", triggers: ["alert"] },
  },
  {
    name: "inline-success",
    title: "Inline Success",
    description: "Inline success message",
    category: "feedback",
    source: "inferred",
    required: true,
    dependencies: ["text"],
    inferredFrom: { rule: "pattern", triggers: ["alert"] },
  },
  {
    name: "loading-overlay",
    title: "Loading Overlay",
    description: "Full-screen loading overlay",
    category: "feedback",
    source: "detected",
    required: true,
    dependencies: ["portal", "spinner"],
  },
];

// =============================================================================
// Overlays & Portals
// =============================================================================

const OVERLAYS: ComponentDefinition[] = [
  {
    name: "modal",
    title: "Modal",
    description: "Modal overlay (alias for dialog)",
    category: "overlays",
    source: "template",
    required: true,
    dependencies: ["dialog"],
  },
  {
    name: "sheet",
    title: "Sheet",
    description: "Slide-in panel from edge of screen",
    category: "overlays",
    source: "detected",
    required: true,
    dependencies: ["portal", "focus-trap"],
  },
  {
    name: "drawer",
    title: "Drawer",
    description: "Drawer panel (mobile-friendly sheet)",
    category: "overlays",
    categories: ["navigation"],
    source: "detected",
    required: true,
    dependencies: ["sheet"],
  },
  {
    name: "context-menu",
    title: "Context Menu",
    description: "Right-click context menu",
    category: "overlays",
    source: "detected",
    required: true,
    dependencies: ["portal", "dropdown-menu"],
  },
  {
    name: "dropdown-menu",
    title: "Dropdown Menu",
    description: "Dropdown menu with items",
    category: "overlays",
    source: "detected",
    required: true,
    dependencies: ["portal", "popover"],
  },
  {
    name: "command",
    title: "Command",
    description: "Command palette component",
    category: "overlays",
    source: "detected",
    required: true,
    dependencies: ["dialog", "input"],
  },
  {
    name: "command-palette",
    title: "Command Palette",
    description: "Full command palette (alias for command)",
    category: "overlays",
    source: "template",
    required: true,
    dependencies: ["command"],
  },
];

// =============================================================================
// Utilities
// =============================================================================

const UTILITIES: ComponentDefinition[] = [
  {
    name: "portal",
    title: "Portal",
    description: "Renders children into a different part of the DOM",
    category: "utility",
    source: "primitive",
    required: true,
    dependencies: [],
  },
  {
    name: "focus-trap",
    title: "Focus Trap",
    description: "Traps focus within a container",
    category: "utility",
    source: "template",
    required: true,
    dependencies: [],
  },
  {
    name: "visually-hidden",
    title: "Visually Hidden",
    description: "Hides content visually while keeping it accessible",
    category: "utility",
    source: "primitive",
    required: true,
    dependencies: [],
  },
  {
    name: "error-boundary",
    title: "Error Boundary",
    description: "React error boundary wrapper",
    category: "utility",
    source: "template",
    required: true,
    dependencies: [],
  },
  {
    name: "direction",
    title: "Direction",
    description: "RTL/LTR direction provider",
    category: "utility",
    source: "template",
    required: true,
    dependencies: [],
  },
];

// =============================================================================
// Media & Rich Content (Optional)
// =============================================================================

const MEDIA: ComponentDefinition[] = [
  {
    name: "image",
    title: "Image",
    description: "Optimized image with loading states",
    category: "media",
    source: "template",
    required: false,
    dependencies: ["skeleton"],
  },
  {
    name: "image-gallery",
    title: "Image Gallery",
    description: "Image gallery with lightbox",
    category: "media",
    source: "detected",
    required: false,
    dependencies: ["image", "lightbox"],
  },
  {
    name: "video-player",
    title: "Video Player",
    description: "Video player with controls",
    category: "media",
    source: "detected",
    required: false,
    dependencies: ["box"],
  },
  {
    name: "audio-player",
    title: "Audio Player",
    description: "Audio player with controls",
    category: "media",
    source: "detected",
    required: false,
    dependencies: ["box", "slider"],
  },
  {
    name: "lightbox",
    title: "Lightbox",
    description: "Full-screen image/media viewer",
    category: "media",
    source: "detected",
    required: false,
    dependencies: ["portal", "dialog"],
  },
  {
    name: "markdown-renderer",
    title: "Markdown Renderer",
    description: "Renders markdown content",
    category: "media",
    source: "template",
    required: false,
    dependencies: ["text", "heading", "code"],
  },
  {
    name: "code-block",
    title: "Code Block",
    description: "Code block with syntax highlighting",
    category: "media",
    source: "template",
    required: false,
    dependencies: ["code"],
  },
  {
    name: "syntax-highlighter",
    title: "Syntax Highlighter",
    description: "Syntax highlighting wrapper",
    category: "media",
    source: "template",
    required: false,
    dependencies: ["code-block"],
  },
];

// =============================================================================
// Advanced (Optional)
// =============================================================================

const ADVANCED: ComponentDefinition[] = [
  {
    name: "virtualized-list",
    title: "Virtualized List",
    description: "Efficiently renders large lists",
    category: "advanced",
    source: "template",
    required: false,
    dependencies: ["list"],
  },
  {
    name: "infinite-scroll",
    title: "Infinite Scroll",
    description: "Infinite scroll container",
    category: "advanced",
    source: "template",
    required: false,
    dependencies: ["box"],
  },
  {
    name: "drag-drop",
    title: "Drag & Drop",
    description: "Drag and drop functionality",
    category: "advanced",
    source: "template",
    required: false,
    dependencies: [],
  },
  {
    name: "resize-handle",
    title: "Resize Handle",
    description: "Draggable resize handle",
    category: "advanced",
    source: "template",
    required: false,
    dependencies: [],
  },
  {
    name: "split-pane",
    title: "Split Pane",
    description: "Resizable split pane layout",
    category: "advanced",
    source: "template",
    required: false,
    dependencies: ["resize-handle", "flex"],
  },
];

// =============================================================================
// Exports
// =============================================================================

/**
 * All component categories with their definitions.
 */
export const CATEGORIES: CategoryDefinition[] = [
  {
    name: "foundations",
    title: "Foundations",
    description: "Design tokens and base system components",
    required: true,
    components: FOUNDATIONS,
  },
  {
    name: "layout",
    title: "Layout Primitives",
    description: "Basic layout and container components",
    required: true,
    components: LAYOUT_PRIMITIVES,
  },
  {
    name: "typography",
    title: "Typography",
    description: "Text and heading components",
    required: true,
    components: TYPOGRAPHY,
  },
  {
    name: "navigation",
    title: "Navigation",
    description: "Navigation and routing components",
    required: true,
    components: NAVIGATION,
  },
  {
    name: "forms",
    title: "Inputs & Forms",
    description: "Form inputs and controls",
    required: true,
    components: FORMS,
  },
  {
    name: "buttons",
    title: "Buttons & Actions",
    description: "Buttons and action triggers",
    required: true,
    components: BUTTONS,
  },
  {
    name: "data-display",
    title: "Data Display",
    description: "Components for displaying data",
    required: true,
    components: DATA_DISPLAY,
  },
  {
    name: "feedback",
    title: "Feedback & Status",
    description: "Alerts, toasts, and status indicators",
    required: true,
    components: FEEDBACK,
  },
  {
    name: "overlays",
    title: "Overlays & Portals",
    description: "Modals, drawers, and floating content",
    required: true,
    components: OVERLAYS,
  },
  {
    name: "utility",
    title: "Utilities",
    description: "Utility components and helpers",
    required: true,
    components: UTILITIES,
  },
  {
    name: "media",
    title: "Media & Rich Content",
    description: "Images, video, and rich content",
    required: false,
    components: MEDIA,
  },
  {
    name: "advanced",
    title: "Advanced",
    description: "Advanced interaction patterns",
    required: false,
    components: ADVANCED,
  },
];

/**
 * All components as a flat array.
 */
export const ALL_COMPONENTS: ComponentDefinition[] = CATEGORIES.flatMap(
  (cat) => cat.components
);

/**
 * Required components only.
 */
export const REQUIRED_COMPONENTS: ComponentDefinition[] = ALL_COMPONENTS.filter(
  (c) => c.required
);

/**
 * Optional components only.
 */
export const OPTIONAL_COMPONENTS: ComponentDefinition[] = ALL_COMPONENTS.filter(
  (c) => !c.required
);

/**
 * Get component by name.
 */
export function getComponent(name: string): ComponentDefinition | undefined {
  return ALL_COMPONENTS.find((c) => c.name === name);
}

/**
 * Get components by category.
 */
export function getComponentsByCategory(
  category: ComponentCategory
): ComponentDefinition[] {
  return ALL_COMPONENTS.filter(
    (c) => c.category === category || c.categories?.includes(category)
  );
}

/**
 * Get components by source type.
 */
export function getComponentsBySource(
  source: ComponentSource
): ComponentDefinition[] {
  return ALL_COMPONENTS.filter((c) => c.source === source);
}

/**
 * Get components that depend on a given component.
 */
export function getDependents(name: string): ComponentDefinition[] {
  return ALL_COMPONENTS.filter((c) => c.dependencies?.includes(name));
}

/**
 * Get all dependencies for a component (recursive).
 */
export function getAllDependencies(name: string): string[] {
  const component = getComponent(name);
  if (!component || !component.dependencies) return [];

  const deps = new Set<string>();
  const queue = [...component.dependencies];

  while (queue.length > 0) {
    const dep = queue.shift()!;
    if (!deps.has(dep)) {
      deps.add(dep);
      const depComponent = getComponent(dep);
      if (depComponent?.dependencies) {
        queue.push(...depComponent.dependencies);
      }
    }
  }

  return Array.from(deps);
}

/**
 * Get generation order respecting dependencies.
 */
export function getGenerationOrder(
  componentNames: string[]
): ComponentDefinition[] {
  const result: ComponentDefinition[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(name: string) {
    if (visited.has(name)) return;
    if (visiting.has(name)) {
      throw new Error(`Circular dependency detected: ${name}`);
    }

    const component = getComponent(name);
    if (!component) return;

    visiting.add(name);

    for (const dep of component.dependencies || []) {
      visit(dep);
    }

    visiting.delete(name);
    visited.add(name);
    result.push(component);
  }

  for (const name of componentNames) {
    visit(name);
  }

  return result;
}

// =============================================================================
// Summary
// =============================================================================

/**
 * Component counts by category.
 */
export const COMPONENT_COUNTS = {
  total: ALL_COMPONENTS.length,
  required: REQUIRED_COMPONENTS.length,
  optional: OPTIONAL_COMPONENTS.length,
  byCategory: Object.fromEntries(
    CATEGORIES.map((cat) => [cat.name, cat.components.length])
  ),
  bySource: {
    primitive: getComponentsBySource("primitive").length,
    detected: getComponentsBySource("detected").length,
    inferred: getComponentsBySource("inferred").length,
    template: getComponentsBySource("template").length,
  },
};
