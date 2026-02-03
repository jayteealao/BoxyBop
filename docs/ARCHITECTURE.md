# BoxyBop Architecture

> UI Screenshot → Tokens + Components Studio

## Overview

BoxyBop is a monorepo that transforms UI screenshots into design tokens and reusable components. It uses OmniParser for element detection, a human-in-the-loop cropper for refinement, and Gemini for structured analysis of cropped regions.

```
Screenshot → OmniParser → Human Crop Adjustments → Cropped PNGs → Gemini Analysis → Tokens + Components → Code Generation
```

## Monorepo Structure

```
BoxyBop/
├── docs/                          # Architecture, ADRs, specs
│   └── ARCHITECTURE.md
├── packages/
│   ├── ir/                        # Intermediate Representation schema (shared)
│   │   ├── schema.ts              # Zod schemas
│   │   ├── schema.json            # JSON Schema export
│   │   └── README.md              # IR documentation + examples
│   ├── omniparser-client/         # OmniParser integration
│   ├── cropper-ui/                # React crop adjustment interface
│   ├── gemini-analyzer/           # Gemini API integration
│   ├── token-extractor/           # Extract design tokens from analysis
│   ├── component-generator/       # Generate React/shadcn components
│   ├── storybook-generator/       # Generate Storybook stories
│   └── registry-builder/          # Build shadcn registry output
├── apps/
│   └── studio/                    # Main web application
└── output/                        # Generated artifacts (gitignored)
    ├── crops/                     # Cropped PNG files
    ├── analysis/                  # Gemini analysis JSON
    ├── tokens/                    # Generated token files
    ├── components/                # Generated components
    └── registry/                  # shadcn registry
```

## Services & Components

### 1. Image Ingestion Service
- **Input**: Screenshot files (PNG, JPEG, WebP)
- **Output**: `ImageSet` IR node
- **Responsibilities**:
  - Compute content hashes (SHA-256)
  - Extract dimensions (width, height)
  - Store original images with unique IDs
  - Track display vs original coordinate systems

### 2. OmniParser Service
- **Input**: `ImageSet`
- **Output**: Array of `ParsedElement` IR nodes
- **Responsibilities**:
  - Send images to OmniParser API/model
  - Receive bounding boxes with labels and confidence scores
  - Convert all coordinates to ORIGINAL pixel space
  - Store both raw parser output and normalized elements

### 3. Cropper UI Service
- **Input**: `ImageSet` + `ParsedElement[]`
- **Output**: `CropSpec[]` (human-adjusted)
- **Responsibilities**:
  - Display image with overlaid bounding boxes
  - Allow human adjustment of boxes (resize, move, delete, add)
  - Maintain mapping between display coordinates and original pixels
  - Emit final crop specifications in original pixel coordinates

### 4. Crop Executor Service
- **Input**: `ImageSet` + `CropSpec[]`
- **Output**: `CropArtifact[]`
- **Responsibilities**:
  - Extract pixel regions from original images
  - Save as PNG files
  - Compute SHA-256 hash of each crop
  - Track dimensions and source relationships

### 5. Gemini Analyzer Service
- **Input**: `CropArtifact[]` (PNG bytes only, NEVER full screenshots)
- **Output**: `GeminiAnalysis[]`
- **Responsibilities**:
  - Send ONLY cropped PNG bytes to Gemini
  - Use versioned prompts for structured JSON output
  - Parse and validate Gemini responses
  - Store model info and prompt version for reproducibility

### 6. Token Extractor Service
- **Input**: `GeminiAnalysis[]`
- **Output**: `TokenCandidate[]`
- **Responsibilities**:
  - Aggregate color values across analyses
  - Detect type scale patterns
  - Identify spacing scales
  - Extract radius and shadow values
  - Deduplicate and normalize tokens

### 7. Component Synthesizer Service
- **Input**: `GeminiAnalysis[]` + `TokenCandidate[]`
- **Output**: `ComponentCandidate[]`
- **Responsibilities**:
  - Group related UI elements
  - Propose component names and categories
  - Identify props, variants, and states
  - Generate deduplication keys
  - Map components to tokens

### 8. Codegen Orchestrator Service
- **Input**: `TokenCandidate[]` + `ComponentCandidate[]`
- **Output**: `CodegenPlan` → `CodegenResult`
- **Responsibilities**:
  - Plan file generation (tokens, components, stories, registry)
  - Invoke Claude Agent SDK for code generation
  - Write files to output directory
  - Run lint and tests
  - Report results

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA FLOW                                       │
└─────────────────────────────────────────────────────────────────────────────┘

[Screenshot PNG/JPEG]
        │
        ▼
┌───────────────────┐
│  Image Ingestion  │──────────────────────────────────────┐
└───────────────────┘                                      │
        │                                                  │
        │ ImageSet                                         │
        ▼                                                  │
┌───────────────────┐                                      │
│    OmniParser     │                                      │
└───────────────────┘                                      │
        │                                                  │
        │ ParsedElement[]                                  │
        ▼                                                  │
┌───────────────────┐                                      │
│    Cropper UI     │◄─────── Human adjustments            │
└───────────────────┘                                      │
        │                                                  │
        │ CropSpec[]                                       │
        ▼                                                  │
┌───────────────────┐                                      │
│  Crop Executor    │◄─────────────────────────────────────┘
└───────────────────┘         (needs original image)
        │
        │ CropArtifact[] (PNG bytes, sha256)
        ▼
┌───────────────────┐
│ Gemini Analyzer   │  ◄─── ONLY receives cropped PNGs
└───────────────────┘
        │
        │ GeminiAnalysis[]
        ├───────────────────────────────────────┐
        ▼                                       ▼
┌───────────────────┐               ┌───────────────────┐
│ Token Extractor   │               │ Component Synth   │
└───────────────────┘               └───────────────────┘
        │                                       │
        │ TokenCandidate[]                      │ ComponentCandidate[]
        └───────────────┬───────────────────────┘
                        ▼
              ┌───────────────────┐
              │ Codegen Orchestr  │
              └───────────────────┘
                        │
                        │ CodegenPlan
                        ▼
              ┌───────────────────┐
              │ Claude Agent SDK  │
              └───────────────────┘
                        │
                        │ CodegenResult
                        ▼
              ┌───────────────────────────────────────┐
              │ Output Files                          │
              │ - tokens.css / tokens.ts              │
              │ - components/*.tsx                    │
              │ - stories/*.stories.tsx               │
              │ - registry.json                       │
              └───────────────────────────────────────┘
```

## Storage

### File Storage
| Type | Location | Format | Retention |
|------|----------|--------|-----------|
| Original images | `output/images/` | PNG/JPEG | Session |
| Cropped regions | `output/crops/` | PNG | Session |
| Analysis results | `output/analysis/` | JSON | Session |
| Generated tokens | `output/tokens/` | CSS/TS | Permanent |
| Generated components | `output/components/` | TSX | Permanent |
| Storybook stories | `output/stories/` | TSX | Permanent |
| Registry manifest | `output/registry/` | JSON | Permanent |

### IR State Storage
- Pipeline state stored as JSON files following IR schema
- Each run creates a session directory with all intermediate artifacts
- Session format: `output/sessions/{timestamp}-{hash}/`

### File Naming Convention
```
crops/{image_id}_{element_index}_{sha256_prefix}.png
analysis/{image_id}_{element_index}.json
components/{component_name}.tsx
stories/{component_name}.stories.tsx
```

## Coordinate Systems

**Critical invariant**: All processing uses ORIGINAL pixel coordinates.

| Context | Coordinate System | Usage |
|---------|-------------------|-------|
| IR storage | Original pixels | Always |
| OmniParser output | Original pixels | Normalized on receipt |
| Cropper display | Display pixels | UI only |
| Cropper output | Original pixels | Converted before emit |
| Crop execution | Original pixels | Source of truth |
| Gemini prompts | Original pixels | For context |

### Coordinate Conversion
```typescript
// Display to Original
originalX = displayX * (originalWidth / displayWidth)
originalY = displayY * (originalHeight / displayHeight)

// Original to Display
displayX = originalX * (displayWidth / originalWidth)
displayY = originalY * (displayHeight / originalHeight)
```

## Security Considerations

### Input Validation
- Validate image file headers before processing
- Limit maximum image dimensions (e.g., 8192x8192)
- Sanitize filenames before storage
- Validate all coordinate values are within image bounds

### API Security
- OmniParser: Use API key from environment variables
- Gemini: Use API key from environment variables
- Never log API keys or include in error messages
- Rate limit API calls to prevent abuse

### Output Safety
- Sanitize generated component names (no path traversal)
- Validate generated code doesn't contain obvious injection vectors
- Run generated code through linter before accepting

### Data Privacy
- Don't send full screenshots to external APIs when crops suffice
- Clear session data after configurable retention period
- Don't log image content or analysis results at INFO level

## Error Handling

### Service Failures
| Service | Failure Mode | Recovery |
|---------|--------------|----------|
| Image Ingestion | Invalid format | Reject with clear error |
| OmniParser | API timeout | Retry with backoff, max 3 attempts |
| OmniParser | No elements found | Allow manual crop creation |
| Cropper UI | Browser crash | Persist state to localStorage |
| Crop Executor | Bounds error | Clamp to image dimensions, warn |
| Gemini | API error | Retry with backoff, surface to user |
| Gemini | Invalid response | Log raw response, use fallback parsing |
| Codegen | Generation error | Show error, allow retry |

### IR Validation
- Validate all IR nodes against Zod schemas on creation
- Reject invalid data early with descriptive errors
- Include validation context in error messages

## Technology Choices

| Layer | Technology | Rationale |
|-------|------------|-----------|
| IR Schema | Zod + zod-to-json-schema | Type-safe, JSON Schema export |
| Monorepo | pnpm workspaces | Fast, disk efficient |
| Frontend | React + TypeScript | Standard, good tooling |
| Cropper | react-image-crop | Maintained, accessible |
| Code Gen | Claude Agent SDK | Consistent with task requirements |
| Testing | Vitest | Fast, ESM native |
| Components | shadcn/ui patterns | Target output format |
| Stories | Storybook 8 | Industry standard |

## Future Considerations

1. **Batch Processing**: Support multiple screenshots in one session
2. **Version Control**: Track IR changes over time
3. **Collaboration**: Multi-user crop adjustments
4. **ML Feedback**: Use human corrections to improve OmniParser
5. **Template Library**: Pre-built component templates for common patterns
6. **Export Formats**: Support Vue, Svelte, and other frameworks
