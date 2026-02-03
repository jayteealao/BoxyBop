# Component Generation Strategy

> Defines what components are generated for each ImageSet and the dependency hierarchy.

## Core Principle

**No hardcoded values in components.** All visual properties must reference tokens.

```
Tokens → Primitives → Components
   ↓         ↓            ↓
 colors    Box        Button
 spacing   Stack      Card
 typography Flex      Input
 radius    Text       Modal
 shadows   Grid       ...
```

## Generation Tiers

### Tier 0: Tokens (ALWAYS GENERATED)

These are **always extracted** from every ImageSet. They form the foundation that everything else depends on.

| Token Type | Description | Required |
|------------|-------------|----------|
| **Colors** | All colors detected (background, foreground, primary, secondary, accent, border, text, semantic) | ✅ Yes |
| **Typography Scale** | Font sizes, weights, line heights, letter spacing | ✅ Yes |
| **Spacing Scale** | Consistent spacing values (4px, 8px, 12px, 16px, etc.) | ✅ Yes |
| **Border Radius** | Corner radius values (none, sm, md, lg, full) | ✅ Yes |
| **Shadows/Elevation** | Box shadow definitions | ✅ Yes |

**Output files:**
```
output/tokens/
├── colors.css          # CSS custom properties
├── colors.ts           # TypeScript constants
├── typography.css
├── typography.ts
├── spacing.css
├── spacing.ts
├── radius.css
├── radius.ts
├── shadows.css
├── shadows.ts
└── index.ts            # Unified export
```

### Tier 1: Primitives (ALWAYS GENERATED)

Layout and typography primitives that use tokens. These are **always generated** because they're building blocks for everything else.

| Primitive | Description | Required |
|-----------|-------------|----------|
| **Box** | Basic container with token-based styling | ✅ Yes |
| **Stack** | Vertical stack with gap from spacing tokens | ✅ Yes |
| **Flex** | Flexbox container | ✅ Yes |
| **Grid** | CSS Grid container | ✅ Yes |
| **Text** | Text with typography tokens | ✅ Yes |
| **Heading** | h1-h6 with typography scale | ✅ Yes |
| **Divider** | Separator using border/color tokens | ✅ Yes |

**Output files:**
```
output/primitives/
├── Box.tsx
├── Stack.tsx
├── Flex.tsx
├── Grid.tsx
├── Text.tsx
├── Heading.tsx
├── Divider.tsx
└── index.ts
```

### Tier 2: Detected Components (CONTEXTUAL)

Generated **only if detected** in the ImageSet. Gemini analysis determines which components are present.

#### 2A: High-Confidence Detection (Usually Generated)

These component types are commonly detected and have clear visual signatures.

| Component | Detection Signal | Generated If Detected |
|-----------|------------------|----------------------|
| **Button** | Clickable element with text/icon, distinct background | ✅ |
| **Input** | Text field, bordered rectangle | ✅ |
| **Card** | Contained area with padding, often elevated | ✅ |
| **Avatar** | Circular/rounded image, typically small | ✅ |
| **Badge** | Small label, often colored | ✅ |
| **Checkbox** | Square with check state | ✅ |
| **Radio** | Circle with selection state | ✅ |
| **Toggle/Switch** | Binary switch element | ✅ |
| **Icon** | Small symbolic graphic | ✅ |

#### 2B: Complex Components (Generated with Sufficient Context)

Require multiple elements or specific patterns to be detected.

| Component | Detection Requirement | Generated If Detected |
|-----------|----------------------|----------------------|
| **Select/Dropdown** | Input + dropdown indicator | ✅ |
| **Modal/Dialog** | Overlay + contained content | ✅ |
| **Tabs** | Multiple tab items + content area | ✅ |
| **Accordion** | Collapsible sections | ✅ |
| **Table** | Grid of cells with headers | ✅ |
| **List** | Repeated similar items | ✅ |
| **Navigation** | Multiple linked items | ✅ |
| **Toast/Alert** | Feedback message element | ✅ |
| **Progress** | Bar or circular indicator | ✅ |
| **Tooltip** | Floating hint element | ✅ |

#### 2C: Domain-Specific (Rarely Auto-Generated)

These require explicit domain knowledge or are too complex for reliable auto-detection.

| Component | Why Optional | Auto-Generate |
|-----------|--------------|---------------|
| **Charts** | Requires data structure knowledge | ❌ No |
| **Maps** | External service dependency | ❌ No |
| **Calendar** | Complex date logic | ❌ No |
| **Kanban** | Domain-specific layout | ❌ No |
| **Chat** | Real-time interaction patterns | ❌ No |
| **File Explorer** | Hierarchical data structure | ❌ No |
| **Rich Text Editor** | Complex editing logic | ❌ No |
| **Video/Audio Player** | Media handling | ❌ No |

### Tier 3: Utility Components (ALWAYS GENERATED)

Infrastructure components that support the component system.

| Utility | Purpose | Required |
|---------|---------|----------|
| **Portal** | Render outside DOM hierarchy | ✅ Yes |
| **VisuallyHidden** | Accessible hidden content | ✅ Yes |
| **FocusTrap** | Modal/dialog focus management | ✅ Yes |
| **ErrorBoundary** | React error handling | ✅ Yes |

## Generation Decision Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    For Each ImageSet                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. ALWAYS: Extract Tokens                                        │
│    - Analyze all crops for colors, typography, spacing           │
│    - Deduplicate and normalize                                   │
│    - Generate token files (CSS + TS)                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. ALWAYS: Generate Primitives                                   │
│    - Box, Stack, Flex, Grid, Text, Heading, Divider              │
│    - All primitives reference tokens (no hardcoded values)       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. ALWAYS: Generate Utilities                                    │
│    - Portal, VisuallyHidden, FocusTrap, ErrorBoundary            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. CONDITIONAL: Generate Detected Components                     │
│    For each GeminiAnalysis:                                      │
│    - Check componentSuggestions                                  │
│    - If component type in Tier 2A/2B → Generate                  │
│    - If component type in Tier 2C → Skip (log as potential)      │
│    - Map detected props/variants/states to component             │
│    - Ensure all styles reference tokens                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. ALWAYS: Generate Stories + Registry                           │
│    - One story file per component                                │
│    - shadcn-style registry.json                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Component-Token Dependency Rules

### Rule 1: No Magic Numbers

```typescript
// ❌ BAD: Hardcoded values
const Button = styled.button`
  padding: 8px 16px;
  border-radius: 4px;
  background: #3b82f6;
`;

// ✅ GOOD: Token references
const Button = styled.button`
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-primary);
`;
```

### Rule 2: Primitives Build on Tokens

```typescript
// Box primitive uses spacing and color tokens
interface BoxProps {
  padding?: keyof typeof spacingTokens;
  margin?: keyof typeof spacingTokens;
  background?: keyof typeof colorTokens;
  borderRadius?: keyof typeof radiusTokens;
}
```

### Rule 3: Components Build on Primitives + Tokens

```typescript
// Button uses Box primitive and color/typography tokens
const Button = ({ variant, children }) => (
  <Box
    as="button"
    padding="3"
    borderRadius="md"
    background={variant === 'primary' ? 'primary' : 'secondary'}
    color={variant === 'primary' ? 'primary-foreground' : 'secondary-foreground'}
    fontSize="sm"
    fontWeight="medium"
  >
    {children}
  </Box>
);
```

## Output Structure

For each ImageSet, the following structure is generated:

```
output/generated/{session-id}/
├── tokens/
│   ├── colors.css           # ✅ Always
│   ├── colors.ts            # ✅ Always
│   ├── typography.css       # ✅ Always
│   ├── typography.ts        # ✅ Always
│   ├── spacing.css          # ✅ Always
│   ├── spacing.ts           # ✅ Always
│   ├── radius.css           # ✅ Always
│   ├── radius.ts            # ✅ Always
│   ├── shadows.css          # ✅ Always
│   ├── shadows.ts           # ✅ Always
│   └── index.ts             # ✅ Always
├── primitives/
│   ├── Box.tsx              # ✅ Always
│   ├── Stack.tsx            # ✅ Always
│   ├── Flex.tsx             # ✅ Always
│   ├── Grid.tsx             # ✅ Always
│   ├── Text.tsx             # ✅ Always
│   ├── Heading.tsx          # ✅ Always
│   ├── Divider.tsx          # ✅ Always
│   └── index.ts             # ✅ Always
├── utilities/
│   ├── Portal.tsx           # ✅ Always
│   ├── VisuallyHidden.tsx   # ✅ Always
│   ├── FocusTrap.tsx        # ✅ Always
│   ├── ErrorBoundary.tsx    # ✅ Always
│   └── index.ts             # ✅ Always
├── components/
│   ├── Button.tsx           # 🔷 If detected
│   ├── Input.tsx            # 🔷 If detected
│   ├── Card.tsx             # 🔷 If detected
│   ├── Avatar.tsx           # 🔷 If detected
│   ├── Badge.tsx            # 🔷 If detected
│   ├── ...                  # 🔷 Other detected components
│   └── index.ts             # ✅ Always (exports detected)
├── stories/
│   ├── tokens.stories.tsx   # ✅ Always (token showcase)
│   ├── primitives.stories.tsx # ✅ Always
│   ├── Button.stories.tsx   # 🔷 If Button detected
│   ├── Input.stories.tsx    # 🔷 If Input detected
│   └── ...                  # 🔷 Per detected component
└── registry.json            # ✅ Always (shadcn format)
```

## Component Categories Reference

### Foundations (Tier 0 + 1)
| Category | Components | Generation |
|----------|------------|------------|
| Tokens | colors, typography, spacing, radius, shadows | ✅ Always |
| Layout Primitives | Box, Stack, Flex, Grid | ✅ Always |
| Typography | Text, Heading | ✅ Always |
| Dividers | Divider | ✅ Always |
| Utilities | Portal, VisuallyHidden, FocusTrap, ErrorBoundary | ✅ Always |

### Navigation (Tier 2)
| Component | Generation |
|-----------|------------|
| Tabs | 🔷 If detected |
| Breadcrumbs | 🔷 If detected |
| Pagination | 🔷 If detected |
| Stepper | 🔷 If detected |
| Sidebar | 🔷 If detected |
| App bar | 🔷 If detected |
| Drawer | 🔷 If detected |

### Inputs & Forms (Tier 2)
| Component | Generation |
|-----------|------------|
| Button | 🔷 If detected |
| Input | 🔷 If detected |
| Textarea | 🔷 If detected |
| Select | 🔷 If detected |
| Checkbox | 🔷 If detected |
| Radio | 🔷 If detected |
| Switch/Toggle | 🔷 If detected |
| Slider | 🔷 If detected |
| Date picker | 🔷 If detected |
| File upload | 🔷 If detected |

### Data Display (Tier 2)
| Component | Generation |
|-----------|------------|
| Card | 🔷 If detected |
| Avatar | 🔷 If detected |
| Badge | 🔷 If detected |
| Chip/Tag | 🔷 If detected |
| Table | 🔷 If detected |
| List | 🔷 If detected |
| Accordion | 🔷 If detected |
| Progress | 🔷 If detected |
| Skeleton | 🔷 If detected |

### Feedback & Overlays (Tier 2)
| Component | Generation |
|-----------|------------|
| Alert | 🔷 If detected |
| Toast | 🔷 If detected |
| Modal | 🔷 If detected |
| Tooltip | 🔷 If detected |
| Popover | 🔷 If detected |
| Dropdown menu | 🔷 If detected |

### Domain-Specific (Tier 2C - Not Auto-Generated)
| Component | Generation |
|-----------|------------|
| Charts | ❌ Not auto-generated |
| Maps | ❌ Not auto-generated |
| Calendar | ❌ Not auto-generated |
| Kanban | ❌ Not auto-generated |
| Chat | ❌ Not auto-generated |
| Rich text editor | ❌ Not auto-generated |
| Video/Audio player | ❌ Not auto-generated |

## IR Schema Alignment

The `ComponentCandidate` in the IR schema maps to this strategy:

```typescript
// From packages/ir/schema.ts
ComponentCandidateSchema = z.object({
  category: z.enum([
    "layout",      // → Tier 1 primitives if new, Tier 2 if complex
    "navigation",  // → Tier 2
    "form",        // → Tier 2
    "feedback",    // → Tier 2
    "data-display",// → Tier 2
    "overlay",     // → Tier 2
    "typography",  // → Tier 1 (Text, Heading)
    "media",       // → Tier 2C (usually skip)
  ]),
  // ...
});
```

The `category` field determines generation tier placement.

## Implementation Notes

1. **Token extraction runs first** - Before any component generation
2. **Primitives are templates** - Same code every time, just different token values
3. **Components are contextual** - Generated based on Gemini analysis
4. **Stories are comprehensive** - Show all variants/states for each component
5. **Registry enables incremental adoption** - Install individual components via shadcn CLI
