/**
 * Primitive Component Templates.
 *
 * These are foundational layout and typography components that are always
 * generated regardless of what's detected in the screenshots. They use
 * locked tokens and provide the building blocks for all other components.
 */

import type { StyleGuideLocked } from "@boxybop/ir";

export interface PrimitiveTemplate {
  name: string;
  description: string;
  category: "layout" | "typography" | "utility";
  /** Token CSS vars this primitive uses */
  tokenRefs: string[];
  /** Generate the component source code */
  generateSource: (tokens: StyleGuideLocked) => string;
  /** Generate the Storybook story */
  generateStory: (tokens: StyleGuideLocked) => string;
}

/**
 * Get spacing token references from locked tokens.
 */
function getSpacingRefs(tokens: StyleGuideLocked): string[] {
  return tokens.tokens.spacing.map((s) => s.cssVar);
}

/**
 * Get radius token references from locked tokens.
 */
function getRadiusRefs(tokens: StyleGuideLocked): string[] {
  return tokens.tokens.radius.map((r) => r.cssVar);
}

/**
 * Get color token references from locked tokens.
 */
function getColorRefs(tokens: StyleGuideLocked): string[] {
  return tokens.tokens.colors.map((c) => c.cssVar);
}

/**
 * Get typography token references from locked tokens.
 */
function getTypographyRefs(tokens: StyleGuideLocked): string[] {
  return tokens.tokens.typography.map((t) => t.cssVar);
}

// =============================================================================
// Box Primitive
// =============================================================================

const BoxTemplate: PrimitiveTemplate = {
  name: "Box",
  description: "Basic container with padding, margin, and background support",
  category: "layout",
  tokenRefs: [],
  generateSource: (tokens) => {
    const spacingVars = tokens.tokens.spacing.map((s) => s.cssVar.replace("--", "")).join(" | ");
    const radiusVars = tokens.tokens.radius.map((r) => r.cssVar.replace("--", "")).join(" | ");

    return `import * as React from "react";
import { cn } from "../lib/utils";

type SpacingToken = "${spacingVars}";
type RadiusToken = "${radiusVars}";

export interface BoxProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Padding using spacing tokens */
  p?: SpacingToken;
  /** Horizontal padding */
  px?: SpacingToken;
  /** Vertical padding */
  py?: SpacingToken;
  /** Margin using spacing tokens */
  m?: SpacingToken;
  /** Horizontal margin */
  mx?: SpacingToken;
  /** Vertical margin */
  my?: SpacingToken;
  /** Border radius using radius tokens */
  radius?: RadiusToken;
  /** Render as a different element */
  as?: React.ElementType;
}

/**
 * Box - Basic container primitive.
 *
 * A flexible container that applies spacing and radius tokens.
 * Use for basic layout needs with consistent design system spacing.
 */
export const Box = React.forwardRef<HTMLDivElement, BoxProps>(
  ({ className, style, p, px, py, m, mx, my, radius, as: Component = "div", ...props }, ref) => {
    const boxStyle: React.CSSProperties = {
      ...style,
      ...(p && { padding: \`var(--\${p})\` }),
      ...(px && { paddingInline: \`var(--\${px})\` }),
      ...(py && { paddingBlock: \`var(--\${py})\` }),
      ...(m && { margin: \`var(--\${m})\` }),
      ...(mx && { marginInline: \`var(--\${mx})\` }),
      ...(my && { marginBlock: \`var(--\${my})\` }),
      ...(radius && { borderRadius: \`var(--\${radius})\` }),
    };

    return <Component ref={ref} className={cn(className)} style={boxStyle} {...props} />;
  }
);

Box.displayName = "Box";
`;
  },
  generateStory: () => `import type { Meta, StoryObj } from "@storybook/react";
import { Box } from "./Box";

const meta: Meta<typeof Box> = {
  title: "Primitives/Box",
  component: Box,
  tags: ["autodocs"],
  argTypes: {
    p: { control: "select" },
    px: { control: "select" },
    py: { control: "select" },
    radius: { control: "select" },
  },
};

export default meta;
type Story = StoryObj<typeof Box>;

export const Default: Story = {
  args: {
    p: "space-4",
    children: "Box content",
    style: { background: "var(--color-surface)" },
  },
};

export const WithRadius: Story = {
  args: {
    p: "space-4",
    radius: "radius-md",
    children: "Rounded box",
    style: { background: "var(--color-surface)", border: "1px solid var(--color-border)" },
  },
};
`,
};

// =============================================================================
// Stack Primitive
// =============================================================================

const StackTemplate: PrimitiveTemplate = {
  name: "Stack",
  description: "Vertical flex container with consistent gap spacing",
  category: "layout",
  tokenRefs: [],
  generateSource: (tokens) => {
    const spacingVars = tokens.tokens.spacing.map((s) => s.cssVar.replace("--", "")).join(" | ");

    return `import * as React from "react";
import { cn } from "../lib/utils";

type SpacingToken = "${spacingVars}";

export interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Gap between children using spacing tokens */
  gap?: SpacingToken;
  /** Horizontal alignment */
  align?: "start" | "center" | "end" | "stretch";
  /** Render as a different element */
  as?: React.ElementType;
}

/**
 * Stack - Vertical flex layout primitive.
 *
 * Arranges children vertically with consistent gap spacing.
 * Use for forms, card content, and any vertical layout needs.
 */
export const Stack = React.forwardRef<HTMLDivElement, StackProps>(
  ({ className, style, gap = "space-4", align = "stretch", as: Component = "div", ...props }, ref) => {
    const stackStyle: React.CSSProperties = {
      ...style,
      display: "flex",
      flexDirection: "column",
      gap: \`var(--\${gap})\`,
      alignItems: align === "stretch" ? "stretch" : \`flex-\${align}\`.replace("flex-center", "center"),
    };

    return <Component ref={ref} className={cn(className)} style={stackStyle} {...props} />;
  }
);

Stack.displayName = "Stack";
`;
  },
  generateStory: () => `import type { Meta, StoryObj } from "@storybook/react";
import { Stack } from "./Stack";
import { Box } from "./Box";

const meta: Meta<typeof Stack> = {
  title: "Primitives/Stack",
  component: Stack,
  tags: ["autodocs"],
  argTypes: {
    gap: { control: "select" },
    align: { control: "select", options: ["start", "center", "end", "stretch"] },
  },
};

export default meta;
type Story = StoryObj<typeof Stack>;

export const Default: Story = {
  args: {
    gap: "space-4",
    children: [
      <Box key="1" p="space-2" style={{ background: "var(--color-surface)" }}>Item 1</Box>,
      <Box key="2" p="space-2" style={{ background: "var(--color-surface)" }}>Item 2</Box>,
      <Box key="3" p="space-2" style={{ background: "var(--color-surface)" }}>Item 3</Box>,
    ],
  },
};

export const Centered: Story = {
  args: {
    gap: "space-2",
    align: "center",
    children: [
      <Box key="1" p="space-2" style={{ background: "var(--color-surface)" }}>Short</Box>,
      <Box key="2" p="space-2" style={{ background: "var(--color-surface)" }}>Medium content</Box>,
      <Box key="3" p="space-2" style={{ background: "var(--color-surface)" }}>Longer content here</Box>,
    ],
  },
};
`,
};

// =============================================================================
// Flex Primitive
// =============================================================================

const FlexTemplate: PrimitiveTemplate = {
  name: "Flex",
  description: "Flexible box container for horizontal and vertical layouts",
  category: "layout",
  tokenRefs: [],
  generateSource: (tokens) => {
    const spacingVars = tokens.tokens.spacing.map((s) => s.cssVar.replace("--", "")).join(" | ");

    return `import * as React from "react";
import { cn } from "../lib/utils";

type SpacingToken = "${spacingVars}";

export interface FlexProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Gap between children using spacing tokens */
  gap?: SpacingToken;
  /** Flex direction */
  direction?: "row" | "column" | "row-reverse" | "column-reverse";
  /** Horizontal alignment (justify-content) */
  justify?: "start" | "center" | "end" | "between" | "around" | "evenly";
  /** Vertical alignment (align-items) */
  align?: "start" | "center" | "end" | "stretch" | "baseline";
  /** Allow wrapping */
  wrap?: boolean;
  /** Render as a different element */
  as?: React.ElementType;
}

const justifyMap = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  between: "space-between",
  around: "space-around",
  evenly: "space-evenly",
};

const alignMap = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
  baseline: "baseline",
};

/**
 * Flex - Flexible box layout primitive.
 *
 * General-purpose flex container for any layout direction.
 * Use for toolbars, button groups, and complex layouts.
 */
export const Flex = React.forwardRef<HTMLDivElement, FlexProps>(
  (
    {
      className,
      style,
      gap,
      direction = "row",
      justify = "start",
      align = "stretch",
      wrap = false,
      as: Component = "div",
      ...props
    },
    ref
  ) => {
    const flexStyle: React.CSSProperties = {
      ...style,
      display: "flex",
      flexDirection: direction,
      justifyContent: justifyMap[justify],
      alignItems: alignMap[align],
      flexWrap: wrap ? "wrap" : "nowrap",
      ...(gap && { gap: \`var(--\${gap})\` }),
    };

    return <Component ref={ref} className={cn(className)} style={flexStyle} {...props} />;
  }
);

Flex.displayName = "Flex";
`;
  },
  generateStory: () => `import type { Meta, StoryObj } from "@storybook/react";
import { Flex } from "./Flex";
import { Box } from "./Box";

const meta: Meta<typeof Flex> = {
  title: "Primitives/Flex",
  component: Flex,
  tags: ["autodocs"],
  argTypes: {
    gap: { control: "select" },
    direction: { control: "select", options: ["row", "column", "row-reverse", "column-reverse"] },
    justify: { control: "select", options: ["start", "center", "end", "between", "around", "evenly"] },
    align: { control: "select", options: ["start", "center", "end", "stretch", "baseline"] },
  },
};

export default meta;
type Story = StoryObj<typeof Flex>;

export const Row: Story = {
  args: {
    gap: "space-2",
    children: [
      <Box key="1" p="space-2" style={{ background: "var(--color-surface)" }}>A</Box>,
      <Box key="2" p="space-2" style={{ background: "var(--color-surface)" }}>B</Box>,
      <Box key="3" p="space-2" style={{ background: "var(--color-surface)" }}>C</Box>,
    ],
  },
};

export const SpaceBetween: Story = {
  args: {
    gap: "space-2",
    justify: "between",
    style: { width: "100%" },
    children: [
      <Box key="1" p="space-2" style={{ background: "var(--color-surface)" }}>Left</Box>,
      <Box key="2" p="space-2" style={{ background: "var(--color-surface)" }}>Right</Box>,
    ],
  },
};

export const Centered: Story = {
  args: {
    justify: "center",
    align: "center",
    style: { height: 200 },
    children: <Box p="space-4" style={{ background: "var(--color-surface)" }}>Centered</Box>,
  },
};
`,
};

// =============================================================================
// Grid Primitive
// =============================================================================

const GridTemplate: PrimitiveTemplate = {
  name: "Grid",
  description: "CSS Grid container for complex two-dimensional layouts",
  category: "layout",
  tokenRefs: [],
  generateSource: (tokens) => {
    const spacingVars = tokens.tokens.spacing.map((s) => s.cssVar.replace("--", "")).join(" | ");

    return `import * as React from "react";
import { cn } from "../lib/utils";

type SpacingToken = "${spacingVars}";

export interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Gap between grid items using spacing tokens */
  gap?: SpacingToken;
  /** Column gap (overrides gap for columns) */
  gapX?: SpacingToken;
  /** Row gap (overrides gap for rows) */
  gapY?: SpacingToken;
  /** Number of columns (creates equal-width columns) */
  columns?: number;
  /** Custom grid-template-columns value */
  templateColumns?: string;
  /** Custom grid-template-rows value */
  templateRows?: string;
  /** Render as a different element */
  as?: React.ElementType;
}

/**
 * Grid - CSS Grid layout primitive.
 *
 * Two-dimensional layout container for complex layouts.
 * Use for card grids, dashboards, and responsive layouts.
 */
export const Grid = React.forwardRef<HTMLDivElement, GridProps>(
  (
    {
      className,
      style,
      gap,
      gapX,
      gapY,
      columns,
      templateColumns,
      templateRows,
      as: Component = "div",
      ...props
    },
    ref
  ) => {
    const gridStyle: React.CSSProperties = {
      ...style,
      display: "grid",
      ...(gap && { gap: \`var(--\${gap})\` }),
      ...(gapX && { columnGap: \`var(--\${gapX})\` }),
      ...(gapY && { rowGap: \`var(--\${gapY})\` }),
      ...(columns && { gridTemplateColumns: \`repeat(\${columns}, minmax(0, 1fr))\` }),
      ...(templateColumns && { gridTemplateColumns: templateColumns }),
      ...(templateRows && { gridTemplateRows: templateRows }),
    };

    return <Component ref={ref} className={cn(className)} style={gridStyle} {...props} />;
  }
);

Grid.displayName = "Grid";
`;
  },
  generateStory: () => `import type { Meta, StoryObj } from "@storybook/react";
import { Grid } from "./Grid";
import { Box } from "./Box";

const meta: Meta<typeof Grid> = {
  title: "Primitives/Grid",
  component: Grid,
  tags: ["autodocs"],
  argTypes: {
    gap: { control: "select" },
    columns: { control: "number" },
  },
};

export default meta;
type Story = StoryObj<typeof Grid>;

export const ThreeColumns: Story = {
  args: {
    gap: "space-4",
    columns: 3,
    children: [
      <Box key="1" p="space-4" style={{ background: "var(--color-surface)" }}>1</Box>,
      <Box key="2" p="space-4" style={{ background: "var(--color-surface)" }}>2</Box>,
      <Box key="3" p="space-4" style={{ background: "var(--color-surface)" }}>3</Box>,
      <Box key="4" p="space-4" style={{ background: "var(--color-surface)" }}>4</Box>,
      <Box key="5" p="space-4" style={{ background: "var(--color-surface)" }}>5</Box>,
      <Box key="6" p="space-4" style={{ background: "var(--color-surface)" }}>6</Box>,
    ],
  },
};

export const AutoFit: Story = {
  args: {
    gap: "space-4",
    templateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    children: [
      <Box key="1" p="space-4" style={{ background: "var(--color-surface)" }}>Auto 1</Box>,
      <Box key="2" p="space-4" style={{ background: "var(--color-surface)" }}>Auto 2</Box>,
      <Box key="3" p="space-4" style={{ background: "var(--color-surface)" }}>Auto 3</Box>,
      <Box key="4" p="space-4" style={{ background: "var(--color-surface)" }}>Auto 4</Box>,
    ],
  },
};
`,
};

// =============================================================================
// Text Primitive
// =============================================================================

const TextTemplate: PrimitiveTemplate = {
  name: "Text",
  description: "Body text component with typography token support",
  category: "typography",
  tokenRefs: [],
  generateSource: (tokens) => {
    const typographyVars = tokens.tokens.typography
      .filter((t) => t.cssVar.includes("body") || t.cssVar.includes("text"))
      .map((t) => t.cssVar.replace("--", ""))
      .join(" | ") || "text-base";
    const colorVars = tokens.tokens.colors.map((c) => c.cssVar.replace("--", "")).join(" | ");

    return `import * as React from "react";
import { cn } from "../lib/utils";

type TypographyToken = "${typographyVars}";
type ColorToken = "${colorVars}";

export interface TextProps extends React.HTMLAttributes<HTMLParagraphElement> {
  /** Typography size token */
  size?: TypographyToken;
  /** Text color token */
  color?: ColorToken;
  /** Font weight */
  weight?: "normal" | "medium" | "semibold" | "bold";
  /** Text alignment */
  align?: "left" | "center" | "right";
  /** Truncate with ellipsis */
  truncate?: boolean;
  /** Render as a different element */
  as?: React.ElementType;
}

const weightMap = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
};

/**
 * Text - Body text primitive.
 *
 * Renders text with typography tokens for consistent styling.
 * Use for paragraphs, labels, and general body text.
 */
export const Text = React.forwardRef<HTMLParagraphElement, TextProps>(
  (
    {
      className,
      style,
      size,
      color,
      weight,
      align,
      truncate = false,
      as: Component = "p",
      ...props
    },
    ref
  ) => {
    const textStyle: React.CSSProperties = {
      ...style,
      ...(size && { fontSize: \`var(--\${size})\` }),
      ...(color && { color: \`var(--\${color})\` }),
      ...(weight && { fontWeight: weightMap[weight] }),
      ...(align && { textAlign: align }),
      ...(truncate && {
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }),
    };

    return <Component ref={ref} className={cn(className)} style={textStyle} {...props} />;
  }
);

Text.displayName = "Text";
`;
  },
  generateStory: () => `import type { Meta, StoryObj } from "@storybook/react";
import { Text } from "./Text";

const meta: Meta<typeof Text> = {
  title: "Primitives/Text",
  component: Text,
  tags: ["autodocs"],
  argTypes: {
    size: { control: "select" },
    color: { control: "select" },
    weight: { control: "select", options: ["normal", "medium", "semibold", "bold"] },
    align: { control: "select", options: ["left", "center", "right"] },
  },
};

export default meta;
type Story = StoryObj<typeof Text>;

export const Default: Story = {
  args: {
    children: "This is body text using the Text primitive.",
  },
};

export const Muted: Story = {
  args: {
    color: "color-muted",
    children: "This is muted helper text.",
  },
};

export const Truncated: Story = {
  args: {
    truncate: true,
    style: { maxWidth: 200 },
    children: "This is a very long text that will be truncated with an ellipsis when it overflows.",
  },
};
`,
};

// =============================================================================
// Heading Primitive
// =============================================================================

const HeadingTemplate: PrimitiveTemplate = {
  name: "Heading",
  description: "Heading component for h1-h6 with typography tokens",
  category: "typography",
  tokenRefs: [],
  generateSource: (tokens) => {
    const headingVars = tokens.tokens.typography
      .filter((t) => t.cssVar.includes("heading") || t.cssVar.includes("title"))
      .map((t) => t.cssVar.replace("--", ""))
      .join(" | ") || "text-heading-1 | text-heading-2 | text-heading-3";
    const colorVars = tokens.tokens.colors.map((c) => c.cssVar.replace("--", "")).join(" | ");

    return `import * as React from "react";
import { cn } from "../lib/utils";

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
type HeadingToken = "${headingVars}";
type ColorToken = "${colorVars}";

export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /** Semantic heading level (h1-h6) */
  level?: HeadingLevel;
  /** Typography size token (overrides level default) */
  size?: HeadingToken;
  /** Text color token */
  color?: ColorToken;
  /** Text alignment */
  align?: "left" | "center" | "right";
}

const levelToTag: Record<HeadingLevel, keyof JSX.IntrinsicElements> = {
  1: "h1",
  2: "h2",
  3: "h3",
  4: "h4",
  5: "h5",
  6: "h6",
};

/**
 * Heading - Semantic heading primitive.
 *
 * Renders headings with proper semantic level and typography tokens.
 * Use for page titles, section headers, and card titles.
 */
export const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ className, style, level = 2, size, color, align, ...props }, ref) => {
    const Component = levelToTag[level];

    const headingStyle: React.CSSProperties = {
      ...style,
      ...(size && { fontSize: \`var(--\${size})\` }),
      ...(color && { color: \`var(--\${color})\` }),
      ...(align && { textAlign: align }),
      margin: 0,
    };

    return <Component ref={ref} className={cn(className)} style={headingStyle} {...props} />;
  }
);

Heading.displayName = "Heading";
`;
  },
  generateStory: () => `import type { Meta, StoryObj } from "@storybook/react";
import { Heading } from "./Heading";

const meta: Meta<typeof Heading> = {
  title: "Primitives/Heading",
  component: Heading,
  tags: ["autodocs"],
  argTypes: {
    level: { control: "select", options: [1, 2, 3, 4, 5, 6] },
    size: { control: "select" },
    color: { control: "select" },
    align: { control: "select", options: ["left", "center", "right"] },
  },
};

export default meta;
type Story = StoryObj<typeof Heading>;

export const H1: Story = {
  args: {
    level: 1,
    children: "Heading Level 1",
  },
};

export const H2: Story = {
  args: {
    level: 2,
    children: "Heading Level 2",
  },
};

export const H3: Story = {
  args: {
    level: 3,
    children: "Heading Level 3",
  },
};

export const Centered: Story = {
  args: {
    level: 2,
    align: "center",
    children: "Centered Heading",
  },
};
`,
};

// =============================================================================
// Divider Primitive
// =============================================================================

const DividerTemplate: PrimitiveTemplate = {
  name: "Divider",
  description: "Visual separator for content sections",
  category: "layout",
  tokenRefs: [],
  generateSource: (tokens) => {
    const spacingVars = tokens.tokens.spacing.map((s) => s.cssVar.replace("--", "")).join(" | ");
    const borderColor = tokens.tokens.colors.find((c) => c.role?.includes("border"))?.cssVar || "--color-border";

    return `import * as React from "react";
import { cn } from "../lib/utils";

type SpacingToken = "${spacingVars}";

export interface DividerProps extends React.HTMLAttributes<HTMLHRElement> {
  /** Orientation of the divider */
  orientation?: "horizontal" | "vertical";
  /** Margin around the divider using spacing tokens */
  spacing?: SpacingToken;
}

/**
 * Divider - Visual separator primitive.
 *
 * Creates visual separation between content sections.
 * Use between cards, in lists, or to separate form sections.
 */
export const Divider = React.forwardRef<HTMLHRElement, DividerProps>(
  ({ className, style, orientation = "horizontal", spacing, ...props }, ref) => {
    const isVertical = orientation === "vertical";

    const dividerStyle: React.CSSProperties = {
      ...style,
      border: "none",
      backgroundColor: "var(${borderColor})",
      ...(isVertical
        ? {
            width: 1,
            height: "100%",
            minHeight: 20,
            ...(spacing && { marginInline: \`var(--\${spacing})\` }),
          }
        : {
            height: 1,
            width: "100%",
            ...(spacing && { marginBlock: \`var(--\${spacing})\` }),
          }),
    };

    return (
      <hr
        ref={ref}
        className={cn(className)}
        style={dividerStyle}
        aria-orientation={orientation}
        {...props}
      />
    );
  }
);

Divider.displayName = "Divider";
`;
  },
  generateStory: () => `import type { Meta, StoryObj } from "@storybook/react";
import { Divider } from "./Divider";
import { Stack } from "./Stack";
import { Flex } from "./Flex";
import { Box } from "./Box";

const meta: Meta<typeof Divider> = {
  title: "Primitives/Divider",
  component: Divider,
  tags: ["autodocs"],
  argTypes: {
    orientation: { control: "select", options: ["horizontal", "vertical"] },
    spacing: { control: "select" },
  },
};

export default meta;
type Story = StoryObj<typeof Divider>;

export const Horizontal: Story = {
  render: () => (
    <Stack gap="space-4">
      <Box p="space-2">Content above</Box>
      <Divider />
      <Box p="space-2">Content below</Box>
    </Stack>
  ),
};

export const Vertical: Story = {
  render: () => (
    <Flex gap="space-4" align="center" style={{ height: 50 }}>
      <Box p="space-2">Left</Box>
      <Divider orientation="vertical" />
      <Box p="space-2">Right</Box>
    </Flex>
  ),
};

export const WithSpacing: Story = {
  render: () => (
    <Stack>
      <Box p="space-2">Content above</Box>
      <Divider spacing="space-6" />
      <Box p="space-2">Content below</Box>
    </Stack>
  ),
};
`,
};

// =============================================================================
// Utility Templates
// =============================================================================

const VisuallyHiddenTemplate: PrimitiveTemplate = {
  name: "VisuallyHidden",
  description: "Hides content visually while keeping it accessible to screen readers",
  category: "utility",
  tokenRefs: [],
  generateSource: () => `import * as React from "react";

export interface VisuallyHiddenProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** The content to hide visually */
  children: React.ReactNode;
}

/**
 * VisuallyHidden - Accessibility utility primitive.
 *
 * Hides content from sighted users while keeping it accessible
 * to screen readers. Use for skip links, form labels, and
 * additional context for assistive technology.
 */
export const VisuallyHidden = React.forwardRef<HTMLSpanElement, VisuallyHiddenProps>(
  ({ children, style, ...props }, ref) => {
    return (
      <span
        ref={ref}
        style={{
          ...style,
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
        {...props}
      >
        {children}
      </span>
    );
  }
);

VisuallyHidden.displayName = "VisuallyHidden";
`,
  generateStory: () => `import type { Meta, StoryObj } from "@storybook/react";
import { VisuallyHidden } from "./VisuallyHidden";

const meta: Meta<typeof VisuallyHidden> = {
  title: "Utilities/VisuallyHidden",
  component: VisuallyHidden,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof VisuallyHidden>;

export const Default: Story = {
  render: () => (
    <button>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
      </svg>
      <VisuallyHidden>Open menu</VisuallyHidden>
    </button>
  ),
};
`,
};

const PortalTemplate: PrimitiveTemplate = {
  name: "Portal",
  description: "Renders children into a different part of the DOM tree",
  category: "utility",
  tokenRefs: [],
  generateSource: () => `import * as React from "react";
import { createPortal } from "react-dom";

export interface PortalProps {
  /** Content to render in the portal */
  children: React.ReactNode;
  /** Target container element (defaults to document.body) */
  container?: Element | null;
}

/**
 * Portal - DOM rendering utility primitive.
 *
 * Renders children into a different part of the DOM tree.
 * Use for modals, tooltips, and popovers that need to escape
 * overflow: hidden or z-index stacking contexts.
 */
export function Portal({ children, container }: PortalProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return createPortal(children, container ?? document.body);
}

Portal.displayName = "Portal";
`,
  generateStory: () => `import type { Meta, StoryObj } from "@storybook/react";
import { Portal } from "./Portal";
import { Box } from "./Box";

const meta: Meta<typeof Portal> = {
  title: "Utilities/Portal",
  component: Portal,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Portal>;

export const Default: Story = {
  render: () => (
    <Box p="space-4" style={{ position: "relative", overflow: "hidden", height: 100 }}>
      <p>This box has overflow: hidden</p>
      <Portal>
        <Box
          p="space-4"
          style={{
            position: "fixed",
            bottom: 20,
            right: 20,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-lg)",
            zIndex: 1000,
          }}
        >
          This is rendered via Portal (escapes overflow)
        </Box>
      </Portal>
    </Box>
  ),
};
`,
};

// =============================================================================
// Exports
// =============================================================================

/**
 * All primitive templates keyed by name.
 */
export const PRIMITIVE_TEMPLATES: Record<string, PrimitiveTemplate> = {
  Box: BoxTemplate,
  Stack: StackTemplate,
  Flex: FlexTemplate,
  Grid: GridTemplate,
  Text: TextTemplate,
  Heading: HeadingTemplate,
  Divider: DividerTemplate,
};

/**
 * All utility templates keyed by name.
 */
export const UTILITY_TEMPLATES: Record<string, PrimitiveTemplate> = {
  VisuallyHidden: VisuallyHiddenTemplate,
  Portal: PortalTemplate,
};

/**
 * Get all token refs used by a primitive.
 */
export function getPrimitiveTokenRefs(
  name: string,
  tokens: StyleGuideLocked
): string[] {
  const template = PRIMITIVE_TEMPLATES[name] || UTILITY_TEMPLATES[name];
  if (!template) return [];

  // Primitives use all relevant token categories
  switch (template.category) {
    case "layout":
      return [...getSpacingRefs(tokens), ...getRadiusRefs(tokens)];
    case "typography":
      return [...getTypographyRefs(tokens), ...getColorRefs(tokens)];
    case "utility":
      return [];
    default:
      return [];
  }
}

/**
 * Generate the utils.ts helper file.
 */
export function generateUtilsFile(): string {
  return `import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge class names with Tailwind CSS conflict resolution.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
`;
}

/**
 * Generate the index.ts barrel export file.
 */
export function generateIndexFile(componentNames: string[]): string {
  const exports = componentNames.map((name) => `export * from "./${name}";`);
  return exports.join("\n") + "\n";
}
