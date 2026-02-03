# BoxyBop Architecture

> UI Screenshot → Tokens + Components Studio

## Overview

BoxyBop is a monorepo that transforms UI screenshots into design tokens and reusable components. It uses OmniParser (via Replicate) for element detection, a human-in-the-loop cropper for refinement, and Gemini for structured analysis of cropped regions.

**Key constraint**: OmniParser runs via Replicate from Node.js, not as a local Python service.

```
┌─────────────┐      ┌──────────────┐      ┌─────────────────────┐
│ apps/studio │ ───► │ apps/pipeline│ ───► │ Replicate OmniParser│
│   (Web UI)  │      │  (Node.js)   │      │    (External API)   │
└─────────────┘      └──────────────┘      └─────────────────────┘
```

Full pipeline:
```
Screenshot → OmniParser (Replicate) → Human Crop Adjustments → Cropped PNGs → Gemini Analysis → Tokens + Components → Code Generation
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
│   ├── replicate-omniparser/      # OmniParser via Replicate client
│   ├── cropper-ui/                # React crop adjustment interface
│   ├── gemini-analyzer/           # Gemini API integration
│   ├── token-extractor/           # Extract design tokens from analysis
│   ├── component-generator/       # Generate React/shadcn components
│   ├── storybook-generator/       # Generate Storybook stories
│   └── registry-builder/          # Build shadcn registry output
├── apps/
│   ├── studio/                    # Main web application (frontend)
│   └── pipeline/                  # Pipeline orchestration service (Node.js backend)
└── output/                        # Generated artifacts (gitignored)
    ├── crops/                     # Cropped PNG files
    ├── analysis/                  # Gemini analysis JSON
    ├── tokens/                    # Generated token files
    ├── components/                # Generated components
    └── registry/                  # shadcn registry
```

## Application Architecture

### apps/studio (Frontend)
- React web application for user interaction
- Displays images and OmniParser results
- Hosts the cropper UI for human adjustments
- Communicates with apps/pipeline via REST/WebSocket API

### apps/pipeline (Backend)
- Node.js service orchestrating the pipeline
- Calls Replicate API for OmniParser
- Calls Gemini API for analysis
- Manages IR state and file artifacts
- Exposes API endpoints for apps/studio

```
┌─────────────────────────────────────────────────────────────────┐
│                        apps/studio                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  Upload  │  │  Review  │  │  Cropper │  │  Export  │        │
│  │   Page   │  │   Page   │  │   Page   │  │   Page   │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
└─────────────────────────────┬───────────────────────────────────┘
                              │ REST API / WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        apps/pipeline                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Ingestion  │  │  OmniParser  │  │   Gemini     │          │
│  │   Handler    │  │   Handler    │  │   Handler    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │    Crop      │  │   Codegen    │  │     IR       │          │
│  │   Handler    │  │   Handler    │  │    Store     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────┬───────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
      ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
      │  Replicate  │ │   Gemini    │ │   Claude    │
      │ OmniParser  │ │     API     │ │  Agent SDK  │
      └─────────────┘ └─────────────┘ └─────────────┘
```

## Services & Components

### 1. Image Ingestion Service
- **Location**: `apps/pipeline`
- **Input**: Screenshot files (PNG, JPEG, WebP)
- **Output**: `ImageSet` IR node
- **Responsibilities**:
  - Compute content hashes (SHA-256)
  - Extract dimensions (width, height)
  - Store original images with unique IDs
  - Track display vs original coordinate systems

### 2. OmniParser Service (via Replicate)
- **Location**: `apps/pipeline` using `packages/replicate-omniparser`
- **Input**: `ImageSet`
- **Output**: Array of `ParsedElement` IR nodes
- **External API**: Replicate (microsoft/omniparser)
- **Responsibilities**:
  - Convert images to base64 for Replicate API
  - Call Replicate's OmniParser model endpoint
  - Poll for prediction completion (Replicate async pattern)
  - Parse response bounding boxes with labels and confidence scores
  - Convert all coordinates to ORIGINAL pixel space
  - Store both raw Replicate output and normalized elements

**Replicate Integration**:
```typescript
// packages/replicate-omniparser/client.ts
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

async function parseScreenshot(imageBase64: string): Promise<OmniParserResult> {
  const output = await replicate.run(
    "microsoft/omniparser:...",
    { input: { image: imageBase64 } }
  );
  return normalizeOmniParserOutput(output);
}
```

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
│                                                                              │
│  apps/studio (Frontend)          apps/pipeline (Backend)     External APIs  │
└─────────────────────────────────────────────────────────────────────────────┘

[User uploads Screenshot]
        │
        │ POST /api/sessions
        ▼
┌───────────────────┐         ┌───────────────────┐
│   apps/studio     │────────►│   apps/pipeline   │
│   Upload Page     │         │  Image Ingestion  │──────────────────────────┐
└───────────────────┘         └───────────────────┘                          │
                                      │                                       │
                                      │ ImageSet                              │
                                      ▼                                       │
                              ┌───────────────────┐     ┌──────────────────┐ │
                              │   apps/pipeline   │────►│    Replicate     │ │
                              │  OmniParser Call  │     │   OmniParser     │ │
                              └───────────────────┘     │  (External API)  │ │
                                      │                 └──────────────────┘ │
                                      │ ParsedElement[]                      │
                                      ▼                                       │
┌───────────────────┐         ┌───────────────────┐                          │
│   apps/studio     │◄────────│   apps/pipeline   │                          │
│    Cropper UI     │         │  Returns results  │                          │
│ (Human adjusts)   │         └───────────────────┘                          │
└───────────────────┘                                                         │
        │                                                                     │
        │ PUT /api/sessions/:id/crops                                         │
        ▼                                                                     │
                              ┌───────────────────┐                          │
                              │   apps/pipeline   │◄─────────────────────────┘
                              │  Crop Executor    │    (needs original image)
                              └───────────────────┘
                                      │
                                      │ CropArtifact[] (PNG bytes, sha256)
                                      ▼
                              ┌───────────────────┐     ┌──────────────────┐
                              │   apps/pipeline   │────►│   Gemini API     │
                              │ Gemini Analyzer   │     │  (External API)  │
                              └───────────────────┘     └──────────────────┘
                                      │                 ◄── ONLY cropped PNGs
                                      │ GeminiAnalysis[]
                                      ├───────────────────────────────────────┐
                                      ▼                                       ▼
                              ┌───────────────────┐               ┌───────────────────┐
                              │   apps/pipeline   │               │   apps/pipeline   │
                              │ Token Extractor   │               │ Component Synth   │
                              └───────────────────┘               └───────────────────┘
                                      │                                       │
                                      │ TokenCandidate[]          ComponentCandidate[]
                                      └───────────────┬───────────────────────┘
                                                      ▼
                                            ┌───────────────────┐
                                            │   apps/pipeline   │
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
┌───────────────────┐                       ┌───────────────────────────────────────┐
│   apps/studio     │◄──────────────────────│ Output Files                          │
│   Export Page     │                       │ - tokens.css / tokens.ts              │
│   (Download)      │                       │ - components/*.tsx                    │
└───────────────────┘                       │ - stories/*.stories.tsx               │
                                            │ - registry.json                       │
                                            └───────────────────────────────────────┘
```

### API Endpoints (apps/pipeline)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sessions` | Create session, upload images |
| GET | `/api/sessions/:id` | Get session state |
| POST | `/api/sessions/:id/parse` | Trigger OmniParser via Replicate |
| GET | `/api/sessions/:id/elements` | Get parsed elements |
| PUT | `/api/sessions/:id/crops` | Submit adjusted crop specs |
| POST | `/api/sessions/:id/analyze` | Trigger Gemini analysis |
| POST | `/api/sessions/:id/generate` | Trigger code generation |
| GET | `/api/sessions/:id/output` | Download generated files |

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
- Replicate (OmniParser): Use `REPLICATE_API_TOKEN` from environment variables
- Gemini: Use `GEMINI_API_KEY` from environment variables
- Claude Agent SDK: Use `ANTHROPIC_API_KEY` from environment variables
- Never log API keys or include in error messages
- Rate limit API calls to prevent abuse
- All external API calls happen in apps/pipeline (backend), never from apps/studio (frontend)

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
| Replicate/OmniParser | API timeout | Retry with backoff, max 3 attempts |
| Replicate/OmniParser | Prediction failed | Log error, surface to user, allow retry |
| Replicate/OmniParser | No elements found | Allow manual crop creation |
| Replicate/OmniParser | Rate limit (429) | Exponential backoff, queue requests |
| Cropper UI | Browser crash | Persist state to localStorage |
| Crop Executor | Bounds error | Clamp to image dimensions, warn |
| Gemini | API error | Retry with backoff, surface to user |
| Gemini | Invalid response | Log raw response, use fallback parsing |
| Codegen | Generation error | Show error, allow retry |

### Replicate-Specific Handling
- Replicate predictions are async; poll `/predictions/{id}` until complete
- Handle `starting`, `processing`, `succeeded`, `failed`, `canceled` states
- Store prediction ID in IR for debugging and retry capability
- Timeout after 5 minutes (OmniParser typically completes in <60s)

### IR Validation
- Validate all IR nodes against Zod schemas on creation
- Reject invalid data early with descriptive errors
- Include validation context in error messages

## Technology Choices

| Layer | Technology | Rationale |
|-------|------------|-----------|
| IR Schema | Zod + zod-to-json-schema | Type-safe, JSON Schema export |
| Monorepo | pnpm workspaces | Fast, disk efficient |
| Frontend (apps/studio) | React + TypeScript | Standard, good tooling |
| Backend (apps/pipeline) | Node.js + Express/Fastify | Same language as frontend, good TypeScript support |
| OmniParser | Replicate API | No local Python dependency, managed infrastructure |
| Vision Analysis | Gemini API | Structured JSON output, multimodal |
| Cropper | react-image-crop | Maintained, accessible |
| Code Gen | Claude Agent SDK | Consistent with task requirements |
| Testing | Vitest | Fast, ESM native |
| Components | shadcn/ui patterns | Target output format |
| Stories | Storybook 8 | Industry standard |

### Why Replicate for OmniParser?

1. **No Python dependency**: Pipeline runs entirely in Node.js
2. **Managed infrastructure**: No GPU provisioning or model hosting
3. **Scalability**: Replicate handles concurrent requests
4. **Simplicity**: Single API call vs. managing a Python subprocess
5. **Cost**: Pay-per-prediction model, no idle infrastructure

## Future Considerations

1. **Batch Processing**: Support multiple screenshots in one session
2. **Version Control**: Track IR changes over time
3. **Collaboration**: Multi-user crop adjustments
4. **ML Feedback**: Use human corrections to improve OmniParser
5. **Template Library**: Pre-built component templates for common patterns
6. **Export Formats**: Support Vue, Svelte, and other frameworks
