# UX Review: Pipeline Visualization & ImageSet Experience

**Date:** 2026-02-03
**Scope:** Studio + Pipeline UX requirements for upload, pipeline progress, and cropping behavior

---

## 1. Current State Inventory

### 1.1 Studio Routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/workspace` | `WorkspacePage` | Upload images, run OmniParser, manual cropping, generate library |
| `/design-systems` | `DesignSystemsPage` | Browse generated UI packages |
| `/design-systems/:setSlug` | `DesignSystemDetailPage` | View package details, tokens, components |

### 1.2 Key Components

| Component | Location | Function |
|-----------|----------|----------|
| `ImageUploader` | `components/ImageUploader.tsx` | Basic drag/drop upload, no preview |
| `BoundingBoxOverlay` | `components/BoundingBoxOverlay.tsx` | Renders OmniParser boxes on image |
| `CropEditor` | `components/CropEditor.tsx` | **Manual crop editing with drag handles** |
| `GenerateLibraryPanel` | `components/GenerateLibraryPanel.tsx` | Triggers pipeline+codegen, basic progress |
| `TokenInspector` | `components/TokenInspector.tsx` | Token swatches for generated packages |
| `ComponentGallery` | `components/ComponentGallery.tsx` | Component list for generated packages |

### 1.3 Reusable UI Components (in `components/ui/`)

- `Card`, `CardHeader` - Container styling
- `Badge`, `StatusBadge` - Labels and status indicators
- `EmptyState`, `LoadingState`, `TableSkeleton`, `CardSkeleton` - Loading/empty states
- `Tabs`, `TabPanel` - Tab navigation
- `SearchInput`, `CopyButton` - Inputs
- `Toast`, `ToastProvider` - Notifications

### 1.4 Pipeline Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | Service health check |
| `/api/parse` | POST | OmniParser single image |
| `/api/analyze-style-set` | POST | Style analysis (Gemini + Claude) |
| `/api/run-set` | POST | Full pipeline orchestration |
| `/api/codegen/v2` | POST | Component generation |
| `/api/codegen/v2/status/:setSlug` | GET | Generation status |
| `/api/ui-packages` | GET | List generated packages |
| `/api/ui-packages/:setSlug/manifest` | GET | Package manifest |

### 1.5 Current Data Flow

```
Upload images → Studio memory
      ↓
Run OmniParser → Elements per image
      ↓
Create crops (manual/auto)
      ↓
POST /run-set → Style + Parse + CropAnalysis → ir.json
      ↓
POST /codegen/v2 → Components + Stories
      ↓
packages/ui-<slug>/
```

### 1.6 Current Cropping Implementation

**Manual Cropping Exists:**
- `CropEditor.tsx` (342 lines) - Full manual crop editor with drag handles
- `WorkspacePage.tsx:140-157` - `handleStartCrop`, `handleCropRegionChange`, `handleCropCancel`, `handleCropConfirm`
- `WorkspacePage.tsx:349-355` - "Edit Crop" button in UI
- `CropSpec.humanAdjusted` flag in types

**Auto Cropping:**
- `run-set.ts:484-528` - Auto-generates crops from OmniParser boxes if no manual crops provided

---

## 2. Gap Analysis vs New Requirements

### 2.1 Upload UX Gaps

| Requirement | Current State | Gap |
|-------------|---------------|-----|
| Thumbnail grid immediately on upload | ❌ No thumbnails | **MISSING** |
| Show count ("8 images uploaded") | ❌ Only index display | **MISSING** |
| Per-image metadata (filename, dimensions, size) | ❌ None shown | **MISSING** |
| Validation errors (unsupported type, too large) | ❌ Silent filter | **MISSING** |
| Persistent header summary | ❌ No summary | **MISSING** |
| Clear CTA buttons (Style Pass, Run Pipeline, etc.) | ⚠️ Only "Generate Library" | **PARTIAL** |

### 2.2 Pipeline Visualization Gaps

| Requirement | Current State | Gap |
|-------------|---------------|-----|
| Stage timeline (queued → style → parse → crop → codegen) | ❌ Basic step bars only | **MISSING** |
| Overall progress bar + stage status badges | ❌ Minimal | **MISSING** |
| Timestamps + duration per stage | ❌ None | **MISSING** |
| Expandable logs per stage | ❌ Flat log list | **MISSING** |
| Per-image row showing stage status | ❌ None | **MISSING** |
| View OmniParser overlays per image (read-only) | ⚠️ Only during editing | **PARTIAL** |
| View auto-crops (read-only gallery) | ❌ None | **MISSING** |
| View style guide + locked tokens | ❌ Only after complete | **MISSING** |
| Clear error states + "retry stage" | ❌ Only "Try Again" resets all | **MISSING** |

### 2.3 Cropping Rules Gaps (Critical)

| Requirement | Current State | Gap |
|-------------|---------------|-----|
| NO manual cropping | ❌ `CropEditor` exists | **MUST REMOVE** |
| Crops from OmniParser boxes only | ⚠️ Works but not enforced | **ENFORCE** |
| Auto-crop gallery (read-only) | ❌ None | **MISSING** |
| Automatic filtering/dedup by IoU | ✓ Exists in run-set.ts | OK |

### 2.4 Visual Indication Gaps

| Requirement | Current State | Gap |
|-------------|---------------|-----|
| Artifact preview (style guide, overlays, crops) | ❌ None during pipeline | **MISSING** |
| Counts and key metrics | ⚠️ Only in final summary | **PARTIAL** |
| Success/failure status with next steps | ⚠️ Basic error message | **PARTIAL** |

---

## 3. Proposed Screens and Components

### 3.1 New Route Structure

```
/workspace                          → WorkspacePage (modified)
/workspace/sets/:setId              → ImageSetPage (NEW)
/workspace/sets/:setId/run/:runId   → PipelineRunPage (NEW)
/design-systems                     → DesignSystemsPage (unchanged)
/design-systems/:setSlug            → DesignSystemDetailPage (unchanged)
```

### 3.2 New Components

#### A. `ImageSetHeader` (new)
**Purpose:** Persistent summary bar for image sets

```
┌─────────────────────────────────────────────────────────────────┐
│ 📁 Screenshot Set                                               │
│ 8 images • 12.4 MB total • Created Feb 3, 2026 at 2:15 PM     │
│                                                                 │
│ [ Run Style Pass ]  [ Run Full Pipeline ]  [ Generate Library ] │
└─────────────────────────────────────────────────────────────────┘
```

**Data needed:**
- `imageCount: number`
- `totalSizeBytes: number`
- `createdAt: string`
- `styleRunId?: string` (if style pass complete)
- `runId?: string` (if pipeline complete)

#### B. `ImageThumbnailGrid` (new)
**Purpose:** Grid of uploaded images with metadata

```
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│  img1  │ │  img2  │ │  img3  │ │  img4  │
│ 1200×800│ │ 1440×900│ │ 800×600 │ │ 1920×1080│
│  1.2MB │ │  2.1MB │ │  0.8MB │ │  3.4MB │
│ ✓ parsed│ │ ⏳ pending│ │ ✓ 12 boxes│ │ ✗ failed │
└────────┘ └────────┘ └────────┘ └────────┘
```

**Data needed per image:**
- `id: string`
- `filename: string`
- `thumbnailUrl: string`
- `dimensions: { width, height }`
- `sizeBytes: number`
- `status: 'pending' | 'parsing' | 'parsed' | 'failed'`
- `elementCount?: number`
- `error?: string`

#### C. `PipelineTimeline` (new)
**Purpose:** Stage-by-stage pipeline progress

```
┌─────────────────────────────────────────────────────────────────┐
│ ● Queued  ─→  ● Style Pass  ─→  ● Parse  ─→  ● Crops  ─→  ● IR │
│   ✓ done      ✓ 4.2s          ⏳ 12/15     ○ pending    ○ pending │
└─────────────────────────────────────────────────────────────────┘
│ Stage: OmniParser                           Elapsed: 8.4s       │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░ 80% (12/15 images)          │
│                                                                 │
│ ▼ Logs                                                          │
│ [14:22:05] Parsing image screenshot-1.png (1200×800)...        │
│ [14:22:08] Found 14 elements, 12 after filter/dedupe           │
│ [14:22:08] Parsing image screenshot-2.png (1440×900)...        │
└─────────────────────────────────────────────────────────────────┘
```

**Data needed:**
- `stages: Array<{ id, label, status, startedAt?, completedAt?, error? }>`
- `currentStage: string`
- `progress: { current: number, total: number }`
- `logs: Array<{ timestamp, level, message }>`

#### D. `ImageStageTable` (new)
**Purpose:** Per-image breakdown of pipeline stages

```
┌────────────────────────────────────────────────────────────────────┐
│ Image              │ Parse   │ Boxes │ Crops │ Analysis │ Status   │
├────────────────────┼─────────┼───────┼───────┼──────────┼──────────┤
│ screenshot-1.png   │ ✓ 1.2s  │ 12    │ 10    │ ✓ 3.4s   │ Complete │
│ screenshot-2.png   │ ✓ 1.8s  │ 8     │ 6     │ ✓ 2.1s   │ Complete │
│ screenshot-3.png   │ ⏳       │ -     │ -     │ -        │ Parsing  │
│ screenshot-4.png   │ ✗ Error │ -     │ -     │ -        │ [Retry]  │
└────────────────────────────────────────────────────────────────────┘
```

**Data needed per image:**
- `imageId: string`
- `filename: string`
- `parseStatus: 'pending' | 'parsing' | 'complete' | 'failed'`
- `parseLatencyMs?: number`
- `boxCount?: number`
- `cropCount?: number`
- `analysisStatus: 'pending' | 'analyzing' | 'complete' | 'failed'`
- `analysisLatencyMs?: number`
- `error?: string`

#### E. `OmniParserOverlayViewer` (new)
**Purpose:** Read-only overlay viewer for a single image

Reuses `BoundingBoxOverlay` but:
- No selection
- No "Edit Crop" action
- Shows element count and types

#### F. `AutoCropGallery` (new)
**Purpose:** Read-only gallery of auto-generated crops

```
┌─────────────────────────────────────────────────────────────────┐
│ Auto-Crops (24 from 8 images)                 Filter by type ▼  │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ │
│ │ btn │ │ card│ │ inp │ │ nav │ │ icon│ │ text│ │ btn │ │ btn │ │
│ │120×40│ │200×150│ │180×36│ │800×60│ │24×24│ │320×18│ │100×36│ │80×32│ │
│ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Data needed:**
- `crops: Array<{ id, cropSpecId, thumbnailUrl, dimensions, elementType, sourceImageId }>`
- Filter by type
- Click to view full crop + source context

#### G. `StyleGuidePreview` (new)
**Purpose:** Preview locked tokens during/after pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│ Locked Style Guide                      Hash: a1b2c3d4...       │
├─────────────────────────────────────────────────────────────────┤
│ Colors (12)                                                     │
│ [███] primary    [███] secondary   [███] background            │
│ [███] foreground [███] muted       [███] accent                │
│                                                                 │
│ Typography (5)                                                  │
│ heading-1: 32px/700  heading-2: 24px/600  body: 16px/400       │
│                                                                 │
│ Spacing (6)                                                     │
│ xs: 4px  sm: 8px  md: 16px  lg: 24px  xl: 32px  2xl: 48px     │
└─────────────────────────────────────────────────────────────────┘
```

**Data needed:**
- `lockedTokens: StyleGuideLocked` (from `/api/analyze-style-set/:id/locked-tokens`)

---

## 4. Data Requirements

### 4.1 New Pipeline Endpoints Needed

#### `GET /api/run-set/:runId/status` (NEW)
Returns real-time pipeline status for polling.

```typescript
interface PipelineStatus {
  runId: string;
  setId: string;
  status: 'queued' | 'style' | 'parse' | 'crop' | 'analysis' | 'complete' | 'failed';
  stages: {
    style: StageStatus;
    parse: StageStatus;
    crop: StageStatus;
    analysis: StageStatus;
  };
  perImage: Array<{
    imageId: string;
    parseStatus: 'pending' | 'parsing' | 'complete' | 'failed';
    parseLatencyMs?: number;
    boxCount?: number;
    cropCount?: number;
    analysisStatus: 'pending' | 'analyzing' | 'complete' | 'failed';
    error?: string;
  }>;
  summary?: {
    imagesProcessed: number;
    elementsDetected: number;
    cropsGenerated: number;
    cropsAnalyzed: number;
  };
  error?: string;
}

interface StageStatus {
  status: 'pending' | 'running' | 'complete' | 'failed';
  startedAt?: string;
  completedAt?: string;
  latencyMs?: number;
  progress?: { current: number; total: number };
  error?: string;
}
```

#### `GET /api/run-set/:runId/crops` (NEW)
Returns auto-generated crops for gallery.

```typescript
interface CropGalleryResponse {
  runId: string;
  crops: Array<{
    cropSpecId: string;
    imageId: string;
    elementType: string;
    dimensions: { width: number; height: number };
    thumbnailBase64: string; // Small preview
  }>;
}
```

#### `GET /api/run-set/:runId/overlay/:imageId` (NEW)
Returns OmniParser results for overlay display.

```typescript
interface OverlayResponse {
  imageId: string;
  width: number;
  height: number;
  elements: Array<{
    id: string;
    bbox: { x: number; y: number; width: number; height: number };
    type: string;
    confidence: number;
  }>;
}
```

### 4.2 Modified Endpoints

#### `POST /api/run-set` (MODIFY)
Add streaming/polling support:
- Return `runId` immediately
- Pipeline runs async
- Client polls `/api/run-set/:runId/status`

---

## 5. Phased Implementation Plan

### PR 1: Upload UX Enhancement (P0)
**Files to modify:**
- `apps/studio/src/components/ImageUploader.tsx` - Add thumbnails, validation
- `apps/studio/src/pages/WorkspacePage.tsx` - Add ImageSetHeader

**New components:**
- `apps/studio/src/components/ImageThumbnailGrid.tsx`
- `apps/studio/src/components/ImageSetHeader.tsx`

**Scope:**
- Thumbnail grid with metadata
- Upload count display
- Validation error messages
- Clear CTA buttons

### PR 2: Remove Manual Cropping (P0 - CRITICAL)
**Files to modify:**
- `apps/studio/src/pages/WorkspacePage.tsx` - Remove crop mode
- `apps/studio/src/types/studio.ts` - Deprecate humanAdjusted

**Files to DELETE:**
- `apps/studio/src/components/CropEditor.tsx`

**Remove from WorkspacePage:**
- `cropMode` state
- `currentCropRegion` state
- `handleStartCrop`, `handleCropRegionChange`, `handleCropCancel`, `handleCropConfirm`
- "Edit Crop" button
- CropEditor rendering

### PR 3: Pipeline Timeline & Status (P0)
**New endpoints:**
- `GET /api/run-set/:runId/status`

**New components:**
- `apps/studio/src/components/PipelineTimeline.tsx`
- `apps/studio/src/components/PipelineStageCard.tsx`

**Modify:**
- `apps/pipeline/src/routes/run-set.ts` - Add status tracking
- `apps/studio/src/components/GenerateLibraryPanel.tsx` - Use new timeline

### PR 4: Per-Image Progress & Overlays (P1)
**New endpoints:**
- `GET /api/run-set/:runId/overlay/:imageId`

**New components:**
- `apps/studio/src/components/ImageStageTable.tsx`
- `apps/studio/src/components/OmniParserOverlayViewer.tsx`

**Scope:**
- Per-image status rows
- Read-only overlay viewer
- Drill-down from table to overlay

### PR 5: Auto-Crop Gallery & Style Preview (P1)
**New endpoints:**
- `GET /api/run-set/:runId/crops`

**New components:**
- `apps/studio/src/components/AutoCropGallery.tsx`
- `apps/studio/src/components/StyleGuidePreview.tsx`

**Scope:**
- Read-only crop gallery
- Style token preview during/after pipeline

### PR 6: Error States & Retry (P2)
**Modify:**
- All pipeline components to show detailed errors
- Add "Retry Stage" actions where supported

**New:**
- `POST /api/run-set/:runId/retry/:stage` endpoint

---

## 6. Prioritized Change List

### P0: Must Implement (Blocker for requirements)

1. **Remove CropEditor and all manual crop UI**
   - Delete `CropEditor.tsx`
   - Remove crop-related state from WorkspacePage
   - Remove "Edit Crop" button
   - *Why:* Hard requirement - NO user-selected/manual cropping

2. **Add upload thumbnail grid + count**
   - New ImageThumbnailGrid component
   - Display "N images uploaded" prominently
   - *Why:* Clear visual indication requirement

3. **Add pipeline stage timeline**
   - PipelineTimeline component
   - Stage-by-stage progress display
   - *Why:* "Show pipeline process end-to-end" requirement

4. **Add per-image status tracking**
   - ImageStageTable component
   - Per-image parse/analysis status
   - *Why:* "Drill-down per image" requirement

### P1: Improves Clarity and DX

5. **Add read-only overlay viewer**
   - OmniParserOverlayViewer component
   - View detected boxes after parsing
   - *Why:* Users need to see what was detected

6. **Add auto-crop gallery**
   - AutoCropGallery component
   - Read-only view of generated crops
   - *Why:* Users need to see auto-crops

7. **Add style guide preview**
   - StyleGuidePreview component
   - Token swatches during pipeline
   - *Why:* "Browse tokens visually" requirement

8. **Add timestamps/duration per stage**
   - Extend PipelineTimeline
   - Show elapsed time per stage
   - *Why:* Performance visibility

### P2: Nice-to-have Polish

9. **Add expandable logs per stage**
   - Collapsible log sections
   - Filter by stage
   - *Why:* Debugging aid

10. **Add "retry stage" action**
    - Retry individual failed stages
    - New endpoint support
    - *Why:* Better error recovery

11. **Add image metadata tooltips**
    - Hover to see full details
    - *Why:* UI polish

---

## 7. Implementation Guidance

### 7.1 Routes to Add/Modify in Studio

```typescript
// apps/studio/src/App.tsx - Add new routes
<Route path="/workspace/sets/:setId" element={<ImageSetPage />} />
<Route path="/workspace/sets/:setId/run/:runId" element={<PipelineRunPage />} />
```

### 7.2 Endpoints to Add in Pipeline

```typescript
// apps/pipeline/src/routes/run-set.ts

// Add status tracking endpoint
runSetRouter.get("/:runId/status", async (req, res) => { ... });

// Add overlay endpoint
runSetRouter.get("/:runId/overlay/:imageId", async (req, res) => { ... });

// Add crops gallery endpoint
runSetRouter.get("/:runId/crops", async (req, res) => { ... });
```

### 7.3 Files to Delete

```
apps/studio/src/components/CropEditor.tsx   # 342 lines - manual crop editor
apps/studio/src/lib/cropGenerator.ts        # If exists - manual crop generation
```

### 7.4 Code to Remove from WorkspacePage

```typescript
// Remove these state variables:
const [cropMode, setCropMode] = useState(false);
const [currentCropRegion, setCurrentCropRegion] = useState<BBox | null>(null);

// Remove these handlers:
const handleStartCrop = ...
const handleCropRegionChange = ...
const handleCropCancel = ...
const handleCropConfirm = ...

// Remove this button:
<button onClick={handleStartCrop}>Edit Crop</button>

// Remove CropEditor rendering:
{cropMode && currentCropRegion ? (
  <CropEditor ... />
) : ( ... )}
```

### 7.5 Tailwind Consistency

Use existing design tokens from `apps/studio/tailwind.config.js`:

```css
/* Colors */
bg-studio-bg, bg-studio-surface, bg-studio-surface-raised
text-ink-primary, text-ink-secondary, text-ink-muted, text-ink-disabled
border-studio-border, border-studio-border-accent

/* Status colors */
text-success, text-warning, text-danger, bg-success/10, bg-danger/10

/* Token type colors */
bg-token-color, bg-token-typography, bg-token-spacing, bg-token-radius, bg-token-shadow

/* Components */
.btn-primary, .btn-secondary, .btn-ghost, .btn-danger
.skeleton (for loading states)
```

---

## 8. Acceptance Criteria Checklist

### Upload UX
- [ ] User can upload N images and immediately see thumbnail grid
- [ ] Count displayed prominently (e.g., "8 images uploaded")
- [ ] Per-image metadata visible: filename, dimensions, file size
- [ ] Validation errors shown for unsupported types or oversized files
- [ ] Header shows summary: image count, total size, created timestamp

### Pipeline Visualization
- [ ] User can open an ImageSet and see a pipeline stage timeline
- [ ] Timeline shows: queued → style pass → parse → crop extraction → analysis → IR → codegen
- [ ] Progress bar and percentage visible for current stage
- [ ] Timestamps and duration shown per completed stage
- [ ] Expandable logs available per stage

### Per-Image Drill-down
- [ ] User can see per-image row showing parse status, box count, crop count
- [ ] User can view OmniParser overlay results per image (read-only)
- [ ] User can view auto-crops per image (read-only gallery)

### Style Guide & Tokens
- [ ] User can see style guide + locked tokens during/after pipeline
- [ ] Token swatches displayed visually (colors, typography, spacing)
- [ ] Token hash displayed for verification

### No Manual Cropping
- [ ] No "Edit Crop" button exists in UI
- [ ] No CropEditor component exists
- [ ] No manual crop creation/editing available anywhere
- [ ] Crops come exclusively from OmniParser boxes

### Error Handling
- [ ] Clear error messages displayed for failed stages
- [ ] "Retry" affordance available where supported
- [ ] Failed images highlighted in per-image table

---

## 9. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Removing manual crop breaks existing workflows | Medium | Auto-crop is already implemented; just needs UI |
| Pipeline status polling adds load | Low | Cache status, use long-polling or SSE |
| Large image sets slow down thumbnail grid | Medium | Lazy load thumbnails, paginate if >50 images |
| Breaking change for existing runs | Low | Keep backward compat in ir.json schema |

---

## 10. Dependencies

- No new npm packages required
- Reuses existing UI component patterns
- Builds on existing pipeline infrastructure
- No new external services

---

*End of UX Review Document*
