# @boxybop/ir

Intermediate Representation (IR) schema for the BoxyBop "UI Screenshot → Tokens + Components" pipeline.

## Overview

This package defines the canonical data structures used throughout the BoxyBop pipeline. All services read and write data conforming to these schemas, ensuring type safety and interoperability.

**Critical Invariant**: All geometry (x, y, width, height) is stored in **ORIGINAL pixel coordinates**. Display coordinates are used only in UI layers and must be converted before storage.

## Installation

```bash
pnpm add @boxybop/ir
```

## Usage

### TypeScript (Zod schemas)

```typescript
import {
  ImageSetSchema,
  ParsedElementSchema,
  CropSpecSchema,
  GeminiAnalysisSchema,
  PipelineSessionSchema,
  type ImageSet,
  type ParsedElement,
  type PipelineSession,
} from "@boxybop/ir";

// Validate incoming data
const imageSet = ImageSetSchema.parse(rawData);

// Type-safe access
console.log(imageSet.images[0].dimensions.width);

// Validate a full session
const session = PipelineSessionSchema.parse(sessionData);
```

### JSON Schema

The JSON Schema is available at `@boxybop/ir/schema.json` for use with other languages or validation tools.

```typescript
import schema from "@boxybop/ir/schema.json";

// Use with ajv, json-schema-validator, etc.
```

## Schema Types

| Type | Description |
|------|-------------|
| `ImageSet` | Collection of input images with metadata and hashes |
| `ParsedElement` | UI element detected by OmniParser (bbox, type, confidence) |
| `CropSpec` | Human-adjusted crop region specification |
| `CropArtifact` | Actual cropped PNG file with hash and dimensions |
| `GeminiAnalysis` | Structured analysis output from Gemini |
| `ComponentCandidate` | Proposed component with props, variants, states |
| `TokenCandidate` | Extracted design tokens (colors, typography, spacing) |
| `CodegenPlan` | Plan for which files to generate |
| `CodegenResult` | Results of code generation including lint/test status |
| `PipelineSession` | Top-level container for a complete processing session |

## Coordinate System

All coordinates use the **original image pixel space**:

- Origin: Top-left corner of the image
- X-axis: Left to right (positive)
- Y-axis: Top to bottom (positive)
- Units: Pixels in the original image dimensions

When displaying in a UI at a different size, convert coordinates:

```typescript
// Original → Display
const displayX = originalX * (displayWidth / originalWidth);
const displayY = originalY * (displayHeight / originalHeight);

// Display → Original (before storing to IR)
const originalX = displayX * (originalWidth / displayWidth);
const originalY = displayY * (displayHeight / displayHeight);
```

## Complete IR Example

Below is a concrete example of a `PipelineSession` showing all major IR nodes:

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Login Screen Analysis",
  "startedAt": "2025-01-15T10:30:00.000Z",
  "completedAt": "2025-01-15T10:35:42.000Z",
  "imageSet": {
    "id": "img-set-001",
    "name": "Mobile Login Screenshots",
    "images": [
      {
        "id": "img-001",
        "filename": "login-screen.png",
        "storagePath": "output/images/img-001.png",
        "mimeType": "image/png",
        "dimensions": {
          "width": 1170,
          "height": 2532
        },
        "contentHash": "a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd",
        "ingestedAt": "2025-01-15T10:30:00.000Z"
      }
    ],
    "createdAt": "2025-01-15T10:30:00.000Z"
  },
  "parsedElements": [
    {
      "id": "elem-001",
      "source": "omniparser",
      "imageId": "img-001",
      "bbox": {
        "x": 85,
        "y": 1200,
        "width": 1000,
        "height": 56
      },
      "elementType": "input",
      "rawLabel": "text_input",
      "confidence": 0.94,
      "parserIndex": 0
    },
    {
      "id": "elem-002",
      "source": "omniparser",
      "imageId": "img-001",
      "bbox": {
        "x": 85,
        "y": 1280,
        "width": 1000,
        "height": 56
      },
      "elementType": "input",
      "rawLabel": "password_input",
      "confidence": 0.92,
      "parserIndex": 1
    },
    {
      "id": "elem-003",
      "source": "omniparser",
      "imageId": "img-001",
      "bbox": {
        "x": 85,
        "y": 1400,
        "width": 1000,
        "height": 52
      },
      "elementType": "button",
      "rawLabel": "primary_button",
      "confidence": 0.97,
      "parserIndex": 2
    }
  ],
  "cropSpecs": [
    {
      "id": "crop-spec-001",
      "imageId": "img-001",
      "sourceElementId": "elem-001",
      "region": {
        "x": 75,
        "y": 1190,
        "width": 1020,
        "height": 76
      },
      "label": "Email Input",
      "humanAdjusted": true,
      "updatedAt": "2025-01-15T10:31:15.000Z"
    },
    {
      "id": "crop-spec-002",
      "imageId": "img-001",
      "sourceElementId": "elem-002",
      "region": {
        "x": 75,
        "y": 1270,
        "width": 1020,
        "height": 76
      },
      "label": "Password Input",
      "humanAdjusted": true,
      "updatedAt": "2025-01-15T10:31:30.000Z"
    },
    {
      "id": "crop-spec-003",
      "imageId": "img-001",
      "sourceElementId": "elem-003",
      "region": {
        "x": 75,
        "y": 1390,
        "width": 1020,
        "height": 72
      },
      "label": "Login Button",
      "humanAdjusted": false,
      "updatedAt": "2025-01-15T10:31:45.000Z"
    }
  ],
  "cropArtifacts": [
    {
      "id": "artifact-001",
      "cropSpecId": "crop-spec-001",
      "sourceImageId": "img-001",
      "storagePath": "output/crops/img-001_0_a1b2c3d4.png",
      "contentHash": "b2c3d4e5f678901234567890123456789012345678901234567890123456bcde",
      "dimensions": {
        "width": 1020,
        "height": 76
      },
      "fileSizeBytes": 8452,
      "createdAt": "2025-01-15T10:32:00.000Z"
    },
    {
      "id": "artifact-002",
      "cropSpecId": "crop-spec-002",
      "sourceImageId": "img-001",
      "storagePath": "output/crops/img-001_1_c3d4e5f6.png",
      "contentHash": "c3d4e5f6789012345678901234567890123456789012345678901234567cdef",
      "dimensions": {
        "width": 1020,
        "height": 76
      },
      "fileSizeBytes": 7891,
      "createdAt": "2025-01-15T10:32:01.000Z"
    },
    {
      "id": "artifact-003",
      "cropSpecId": "crop-spec-003",
      "sourceImageId": "img-001",
      "storagePath": "output/crops/img-001_2_d4e5f678.png",
      "contentHash": "d4e5f67890123456789012345678901234567890123456789012345678defab",
      "dimensions": {
        "width": 1020,
        "height": 72
      },
      "fileSizeBytes": 6234,
      "createdAt": "2025-01-15T10:32:02.000Z"
    }
  ],
  "analyses": [
    {
      "id": "analysis-001",
      "cropArtifactId": "artifact-001",
      "model": "gemini-1.5-pro",
      "promptVersion": "1.2.0",
      "analyzedAt": "2025-01-15T10:33:00.000Z",
      "latencyMs": 1250,
      "colors": [
        {
          "role": "background",
          "value": "#FFFFFF",
          "confidence": 0.98
        },
        {
          "role": "border",
          "value": "#E5E7EB",
          "confidence": 0.95
        },
        {
          "role": "text",
          "value": "#111827",
          "confidence": 0.92
        },
        {
          "role": "text-muted",
          "value": "#9CA3AF",
          "confidence": 0.88
        }
      ],
      "typography": [
        {
          "role": "body",
          "fontSize": "16px",
          "fontWeight": 400,
          "lineHeight": 1.5
        },
        {
          "role": "label",
          "fontSize": "14px",
          "fontWeight": 500,
          "lineHeight": 1.25
        }
      ],
      "spacing": [
        {
          "context": "padding",
          "value": "12px"
        },
        {
          "context": "padding",
          "value": "16px"
        }
      ],
      "borderRadius": ["8px"],
      "boxShadows": ["0 1px 2px 0 rgba(0, 0, 0, 0.05)"],
      "componentSuggestions": [
        {
          "name": "TextInput",
          "category": "form",
          "props": [
            {
              "name": "placeholder",
              "type": "string",
              "required": false
            },
            {
              "name": "value",
              "type": "string",
              "required": false
            },
            {
              "name": "onChange",
              "type": "(value: string) => void",
              "required": false
            },
            {
              "name": "disabled",
              "type": "boolean",
              "required": false,
              "defaultValue": false
            }
          ],
          "variants": ["default", "error"],
          "states": ["default", "focus", "disabled"]
        }
      ],
      "description": "A text input field with rounded corners, subtle border, and placeholder text styling"
    },
    {
      "id": "analysis-003",
      "cropArtifactId": "artifact-003",
      "model": "gemini-1.5-pro",
      "promptVersion": "1.2.0",
      "analyzedAt": "2025-01-15T10:33:30.000Z",
      "latencyMs": 980,
      "colors": [
        {
          "role": "primary",
          "value": "#2563EB",
          "confidence": 0.97
        },
        {
          "role": "foreground",
          "value": "#FFFFFF",
          "confidence": 0.99
        }
      ],
      "typography": [
        {
          "role": "button",
          "fontSize": "16px",
          "fontWeight": 600,
          "lineHeight": 1.25
        }
      ],
      "spacing": [
        {
          "context": "padding",
          "value": "12px"
        },
        {
          "context": "padding",
          "value": "24px"
        }
      ],
      "borderRadius": ["8px"],
      "boxShadows": ["0 1px 3px 0 rgba(0, 0, 0, 0.1)"],
      "componentSuggestions": [
        {
          "name": "Button",
          "category": "form",
          "props": [
            {
              "name": "children",
              "type": "React.ReactNode",
              "required": true
            },
            {
              "name": "onClick",
              "type": "() => void",
              "required": false
            },
            {
              "name": "disabled",
              "type": "boolean",
              "required": false,
              "defaultValue": false
            },
            {
              "name": "loading",
              "type": "boolean",
              "required": false,
              "defaultValue": false
            }
          ],
          "variants": ["primary", "secondary", "ghost"],
          "states": ["default", "hover", "active", "focus", "disabled", "loading"]
        }
      ],
      "description": "A primary action button with solid blue background and white text"
    }
  ],
  "tokenCandidates": {
    "id": "tokens-001",
    "colors": [
      {
        "name": "color-primary-600",
        "value": "#2563EB",
        "role": "primary",
        "sourceAnalysisIds": ["analysis-003"]
      },
      {
        "name": "color-gray-100",
        "value": "#F3F4F6",
        "sourceAnalysisIds": ["analysis-001"]
      },
      {
        "name": "color-gray-200",
        "value": "#E5E7EB",
        "role": "border",
        "sourceAnalysisIds": ["analysis-001"]
      },
      {
        "name": "color-gray-400",
        "value": "#9CA3AF",
        "role": "text-muted",
        "sourceAnalysisIds": ["analysis-001"]
      },
      {
        "name": "color-gray-900",
        "value": "#111827",
        "role": "text",
        "sourceAnalysisIds": ["analysis-001"]
      },
      {
        "name": "color-white",
        "value": "#FFFFFF",
        "role": "background",
        "sourceAnalysisIds": ["analysis-001", "analysis-003"]
      }
    ],
    "typeScale": [
      {
        "name": "text-sm",
        "fontSize": "14px",
        "lineHeight": 1.25,
        "fontWeight": 500,
        "sourceAnalysisIds": ["analysis-001"]
      },
      {
        "name": "text-base",
        "fontSize": "16px",
        "lineHeight": 1.5,
        "fontWeight": 400,
        "sourceAnalysisIds": ["analysis-001", "analysis-003"]
      },
      {
        "name": "text-button",
        "fontSize": "16px",
        "lineHeight": 1.25,
        "fontWeight": 600,
        "sourceAnalysisIds": ["analysis-003"]
      }
    ],
    "spacing": [
      {
        "name": "space-3",
        "value": "12px",
        "sourceAnalysisIds": ["analysis-001", "analysis-003"]
      },
      {
        "name": "space-4",
        "value": "16px",
        "sourceAnalysisIds": ["analysis-001"]
      },
      {
        "name": "space-6",
        "value": "24px",
        "sourceAnalysisIds": ["analysis-003"]
      }
    ],
    "radius": [
      {
        "name": "radius-md",
        "value": "8px",
        "sourceAnalysisIds": ["analysis-001", "analysis-003"]
      }
    ],
    "shadows": [
      {
        "name": "shadow-sm",
        "value": "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        "sourceAnalysisIds": ["analysis-001"]
      },
      {
        "name": "shadow-md",
        "value": "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
        "sourceAnalysisIds": ["analysis-003"]
      }
    ],
    "createdAt": "2025-01-15T10:34:00.000Z"
  },
  "componentCandidates": [
    {
      "id": "comp-001",
      "dedupKey": "TextInput:form:v1",
      "name": "TextInput",
      "category": "form",
      "sourceAnalysisIds": ["analysis-001"],
      "props": [
        {
          "name": "placeholder",
          "type": "string",
          "required": false,
          "description": "Placeholder text shown when empty"
        },
        {
          "name": "value",
          "type": "string",
          "required": false,
          "description": "Current input value"
        },
        {
          "name": "onChange",
          "type": "(value: string) => void",
          "required": false,
          "description": "Called when value changes"
        },
        {
          "name": "disabled",
          "type": "boolean",
          "required": false,
          "description": "Whether input is disabled",
          "defaultValue": false
        },
        {
          "name": "error",
          "type": "string",
          "required": false,
          "description": "Error message to display"
        }
      ],
      "variants": [
        {
          "name": "variant",
          "values": ["default", "error"],
          "defaultValue": "default"
        }
      ],
      "states": ["default", "focus", "disabled"],
      "tokenRefs": [
        "color-white",
        "color-gray-200",
        "color-gray-400",
        "color-gray-900",
        "radius-md",
        "shadow-sm",
        "space-3",
        "space-4",
        "text-base"
      ],
      "createdAt": "2025-01-15T10:34:30.000Z"
    },
    {
      "id": "comp-002",
      "dedupKey": "Button:form:v1",
      "name": "Button",
      "category": "form",
      "sourceAnalysisIds": ["analysis-003"],
      "props": [
        {
          "name": "children",
          "type": "React.ReactNode",
          "required": true,
          "description": "Button content"
        },
        {
          "name": "onClick",
          "type": "() => void",
          "required": false,
          "description": "Click handler"
        },
        {
          "name": "disabled",
          "type": "boolean",
          "required": false,
          "description": "Whether button is disabled",
          "defaultValue": false
        },
        {
          "name": "loading",
          "type": "boolean",
          "required": false,
          "description": "Whether button is in loading state",
          "defaultValue": false
        }
      ],
      "variants": [
        {
          "name": "variant",
          "values": ["primary", "secondary", "ghost"],
          "defaultValue": "primary"
        },
        {
          "name": "size",
          "values": ["sm", "md", "lg"],
          "defaultValue": "md"
        }
      ],
      "states": ["default", "hover", "active", "focus", "disabled", "loading"],
      "tokenRefs": [
        "color-primary-600",
        "color-white",
        "radius-md",
        "shadow-md",
        "space-3",
        "space-6",
        "text-button"
      ],
      "createdAt": "2025-01-15T10:34:45.000Z"
    }
  ],
  "codegenPlan": {
    "id": "plan-001",
    "tokenCandidateId": "tokens-001",
    "componentCandidateIds": ["comp-001", "comp-002"],
    "files": [
      {
        "path": "tokens/colors.css",
        "type": "token-css",
        "description": "CSS custom properties for color tokens",
        "sourceIds": ["tokens-001"]
      },
      {
        "path": "tokens/index.ts",
        "type": "token-ts",
        "description": "TypeScript token constants",
        "sourceIds": ["tokens-001"]
      },
      {
        "path": "components/TextInput.tsx",
        "type": "component",
        "description": "TextInput component implementation",
        "sourceIds": ["comp-001"]
      },
      {
        "path": "components/Button.tsx",
        "type": "component",
        "description": "Button component implementation",
        "sourceIds": ["comp-002"]
      },
      {
        "path": "stories/TextInput.stories.tsx",
        "type": "story",
        "description": "Storybook stories for TextInput",
        "sourceIds": ["comp-001"]
      },
      {
        "path": "stories/Button.stories.tsx",
        "type": "story",
        "description": "Storybook stories for Button",
        "sourceIds": ["comp-002"]
      },
      {
        "path": "registry.json",
        "type": "registry",
        "description": "shadcn registry manifest",
        "sourceIds": ["comp-001", "comp-002"]
      }
    ],
    "outputRoot": "output/generated",
    "createdAt": "2025-01-15T10:35:00.000Z"
  },
  "codegenResult": {
    "id": "result-001",
    "planId": "plan-001",
    "files": [
      {
        "plannedPath": "tokens/colors.css",
        "actualPath": "output/generated/tokens/colors.css",
        "contentHash": "e5f6789012345678901234567890123456789012345678901234567890efab12",
        "sizeBytes": 1243,
        "success": true
      },
      {
        "plannedPath": "tokens/index.ts",
        "actualPath": "output/generated/tokens/index.ts",
        "contentHash": "f67890123456789012345678901234567890123456789012345678901fab1234",
        "sizeBytes": 2156,
        "success": true
      },
      {
        "plannedPath": "components/TextInput.tsx",
        "actualPath": "output/generated/components/TextInput.tsx",
        "contentHash": "7890123456789012345678901234567890123456789012345678901234ab1234",
        "sizeBytes": 3421,
        "success": true
      },
      {
        "plannedPath": "components/Button.tsx",
        "actualPath": "output/generated/components/Button.tsx",
        "contentHash": "890123456789012345678901234567890123456789012345678901234bcd1234",
        "sizeBytes": 4102,
        "success": true
      },
      {
        "plannedPath": "stories/TextInput.stories.tsx",
        "actualPath": "output/generated/stories/TextInput.stories.tsx",
        "contentHash": "90123456789012345678901234567890123456789012345678901234cdef1234",
        "sizeBytes": 2876,
        "success": true
      },
      {
        "plannedPath": "stories/Button.stories.tsx",
        "actualPath": "output/generated/stories/Button.stories.tsx",
        "contentHash": "0123456789012345678901234567890123456789012345678901234def12345",
        "sizeBytes": 3542,
        "success": true
      },
      {
        "plannedPath": "registry.json",
        "actualPath": "output/generated/registry.json",
        "contentHash": "123456789012345678901234567890123456789012345678901234ef123456",
        "sizeBytes": 892,
        "success": true
      }
    ],
    "validations": [
      {
        "path": "output/generated/tokens/index.ts",
        "type": "typecheck",
        "passed": true
      },
      {
        "path": "output/generated/components/TextInput.tsx",
        "type": "typecheck",
        "passed": true
      },
      {
        "path": "output/generated/components/TextInput.tsx",
        "type": "lint",
        "passed": true
      },
      {
        "path": "output/generated/components/Button.tsx",
        "type": "typecheck",
        "passed": true
      },
      {
        "path": "output/generated/components/Button.tsx",
        "type": "lint",
        "passed": true
      }
    ],
    "success": true,
    "summary": "Generated 7 files (2 token files, 2 components, 2 stories, 1 registry). All validations passed.",
    "completedAt": "2025-01-15T10:35:42.000Z",
    "durationMs": 42000
  }
}
```

## Schema Versioning

The IR schema follows semantic versioning:

- **Patch** (0.0.x): Bug fixes, documentation updates
- **Minor** (0.x.0): New optional fields, new enum values
- **Major** (x.0.0): Breaking changes to required fields or structure

When reading IR files, always check the schema version and handle migrations appropriately.

## Validation

All data entering the pipeline should be validated using the Zod schemas:

```typescript
import { PipelineSessionSchema } from "@boxybop/ir";

function loadSession(filePath: string): PipelineSession {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return PipelineSessionSchema.parse(raw); // Throws if invalid
}
```

For partial validation during streaming or incremental processing:

```typescript
import { ImageSetSchema, ParsedElementSchema } from "@boxybop/ir";

// Validate just the image set
const imageSet = ImageSetSchema.parse(rawImageSet);

// Validate elements as they arrive
for (const rawElement of rawElements) {
  const element = ParsedElementSchema.parse(rawElement);
  processElement(element);
}
```

## Development

```bash
# Install dependencies
pnpm install

# Build TypeScript
pnpm build

# Run tests
pnpm test

# Regenerate JSON Schema from Zod
pnpm generate-json-schema

# Type check
pnpm typecheck
```
