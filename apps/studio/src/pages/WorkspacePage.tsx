/**
 * Workspace Page - Upload images, run pipeline, view results.
 *
 * This page provides the main workflow:
 * 1. Upload screenshots
 * 2. Run full pipeline (style analysis + OmniParser + crop analysis)
 * 3. View results (overlays, auto-crops, style guide)
 * 4. Generate component library
 *
 * NOTE: Manual cropping has been removed. All crops are auto-generated
 * from OmniParser detected elements.
 */

import { useCallback, useEffect, useState, useMemo } from "react";
import { Card, CardHeader } from "../components/ui";
import { ImageUploader } from "../components/ImageUploader";
import { ImageThumbnailGrid } from "../components/ImageThumbnailGrid";
import { ImageSetHeader } from "../components/ImageSetHeader";
import { BoundingBoxOverlay } from "../components/BoundingBoxOverlay";
import { OmniParserOverlayViewer } from "../components/OmniParserOverlayViewer";
import { AutoCropGallery, type AutoCrop } from "../components/AutoCropGallery";
import { StyleGuidePreview, type StyleTokens } from "../components/StyleGuidePreview";
import {
  PipelineTimeline,
  createDefaultStages,
  updateStageStatus,
  type PipelineStage,
  type PipelineLog,
} from "../components/PipelineTimeline";
import { ImageStageTable, type ImageStageStatus } from "../components/ImageStageTable";
import type {
  StudioImage,
  DetectedElement,
  ParseResult,
  RunSetResponse,
  CodegenResponse,
} from "../types/studio";

interface HealthStatus {
  status: string;
  services: {
    replicate: string;
    gemini?: string;
    anthropic?: string;
  };
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type ViewMode = "grid" | "overlay" | "crops" | "style";

export function WorkspacePage() {
  // Images state
  const [images, setImages] = useState<StudioImage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [createdAt] = useState(() => new Date());

  // Elements per image (from OmniParser)
  const [elementsMap, setElementsMap] = useState<Map<string, DetectedElement[]>>(new Map());

  // Selection (read-only, for viewing element details)
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  // Pipeline state
  const [isRunningPipeline, setIsRunningPipeline] = useState(false);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>(createDefaultStages());
  const [pipelineLogs, setPipelineLogs] = useState<PipelineLog[]>([]);
  const [pipelineResult, setPipelineResult] = useState<RunSetResponse | null>(null);
  const [codegenResult, setCodegenResult] = useState<CodegenResponse | null>(null);

  // Per-image status tracking
  const [imageStageStatuses, setImageStageStatuses] = useState<Map<string, ImageStageStatus>>(new Map());

  // Auto-crops (generated from pipeline)
  const [autoCrops, setAutoCrops] = useState<AutoCrop[]>([]);

  // Style tokens (from pipeline)
  const [styleTokens, setStyleTokens] = useState<StyleTokens | null>(null);
  const [tokensHash, setTokensHash] = useState<string>("");
  const [styleRunId, setStyleRunId] = useState<string>("");

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [setSlug, setSetSlug] = useState("");

  // Check health on mount
  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  const currentImage = images[currentIndex] ?? null;
  const currentElements = currentImage ? elementsMap.get(currentImage.id) ?? [] : [];

  const handleImagesAdded = useCallback((newImages: StudioImage[]) => {
    setImages((prev) => [...prev, ...newImages]);
    setError(null);
    // Reset pipeline state when new images are added
    setPipelineStages(createDefaultStages());
    setPipelineLogs([]);
    setPipelineResult(null);
    setCodegenResult(null);
    setAutoCrops([]);
    setStyleTokens(null);
  }, []);

  const handleSelectImage = useCallback((index: number) => {
    setCurrentIndex(index);
    setSelectedElementId(null);
  }, []);

  const handleSelectElement = useCallback((id: string | null) => {
    setSelectedElementId(id);
  }, []);

  const handleRemoveImage = useCallback(() => {
    if (!currentImage) return;
    setImages((prev) => prev.filter((img) => img.id !== currentImage.id));
    setElementsMap((prev) => {
      const next = new Map(prev);
      next.delete(currentImage.id);
      return next;
    });
    setCurrentIndex((i) => Math.max(0, i - 1));
    setSelectedElementId(null);
  }, [currentImage]);

  const addLog = useCallback((level: PipelineLog["level"], message: string, stage?: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setPipelineLogs((prev) => [...prev, { timestamp, level, message, stage }]);
  }, []);

  // Run OmniParser on a single image (for preview)
  const handleRunOmniParser = useCallback(async () => {
    if (!currentImage) return;

    setError(null);
    setSelectedElementId(null);
    addLog("info", `Parsing ${currentImage.filename}...`, "parse");

    // Update image status
    setImageStageStatuses((prev) => {
      const next = new Map(prev);
      next.set(currentImage.id, {
        imageId: currentImage.id,
        parseStatus: "parsing",
        analysisStatus: "pending",
      });
      return next;
    });

    try {
      const response = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_id: currentImage.id,
          image_png_base64: currentImage.base64,
          width: currentImage.naturalWidth,
          height: currentImage.naturalHeight,
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.message || `Parse failed: ${response.status}`);
      }

      const result: ParseResult = await response.json();

      setElementsMap((prev) => {
        const next = new Map(prev);
        next.set(currentImage.id, result.elements);
        return next;
      });

      // Update image status
      setImageStageStatuses((prev) => {
        const next = new Map(prev);
        const existing = next.get(currentImage.id);
        next.set(currentImage.id, {
          ...existing,
          imageId: currentImage.id,
          parseStatus: "complete",
          boxCount: result.elements.length,
          analysisStatus: existing?.analysisStatus ?? "pending",
        });
        return next;
      });

      addLog("info", `Found ${result.elements.length} elements in ${currentImage.filename}`, "parse");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      addLog("error", message, "parse");

      // Update image status
      setImageStageStatuses((prev) => {
        const next = new Map(prev);
        next.set(currentImage.id, {
          imageId: currentImage.id,
          parseStatus: "failed",
          analysisStatus: "pending",
          error: message,
        });
        return next;
      });
    }
  }, [currentImage, addLog]);

  // Run full pipeline
  const handleRunPipeline = useCallback(async () => {
    if (images.length === 0 || !setSlug.trim()) return;

    setIsRunningPipeline(true);
    setError(null);
    setPipelineStages(createDefaultStages());
    setPipelineLogs([]);
    setPipelineResult(null);
    setCodegenResult(null);

    const setId = `set-${generateId()}`;
    const slug = setSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const startTime = Date.now();

    try {
      // Update stage: queued -> style
      setPipelineStages((stages) => updateStageStatus(stages, "queue", { status: "complete", latencyMs: 0 }));
      setPipelineStages((stages) => updateStageStatus(stages, "style", { status: "running", startedAt: new Date().toISOString() }));
      addLog("info", `Starting pipeline for ${images.length} images...`, "style");

      // Run pipeline
      const pipelineResponse = await fetch("/api/run-set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setId,
          images: images.map((img) => ({
            id: img.id,
            base64: img.base64,
            mimeType: img.mimeType,
            width: img.naturalWidth,
            height: img.naturalHeight,
          })),
        }),
      });

      if (!pipelineResponse.ok) {
        const errBody = await pipelineResponse.json().catch(() => ({}));
        throw new Error(errBody.message || `Pipeline failed: ${pipelineResponse.status}`);
      }

      const result: RunSetResponse = await pipelineResponse.json();
      setPipelineResult(result);
      setStyleRunId(result.styleRunId);
      setTokensHash(result.summary.tokensHash);

      // Update stages
      setPipelineStages((stages) => {
        let updated = updateStageStatus(stages, "style", {
          status: "complete",
          latencyMs: result.latency.styleMs,
        });
        updated = updateStageStatus(updated, "parse", {
          status: "complete",
          latencyMs: result.latency.parseMs,
        });
        updated = updateStageStatus(updated, "crop", { status: "complete" });
        updated = updateStageStatus(updated, "analysis", {
          status: "complete",
          latencyMs: result.latency.cropAnalysisMs,
        });
        updated = updateStageStatus(updated, "ir", { status: "complete" });
        return updated;
      });

      addLog("info", `Pipeline complete: ${result.summary.elementsDetected} elements, ${result.summary.cropsAnalyzed} crops`, "ir");
      addLog("info", `Tokens locked: ${result.summary.tokensHash.slice(0, 12)}...`, "style");

      // Fetch style tokens for preview
      try {
        const tokensResponse = await fetch(`/api/analyze-style-set/${result.styleRunId}/locked-tokens`);
        if (tokensResponse.ok) {
          const lockedTokens = await tokensResponse.json();
          setStyleTokens({
            colors: lockedTokens.tokens?.colors || [],
            typography: lockedTokens.tokens?.typography || [],
            spacing: lockedTokens.tokens?.spacing || [],
            radius: lockedTokens.tokens?.radius || [],
            shadows: lockedTokens.tokens?.shadows || [],
          });
        }
      } catch {
        // Tokens preview not critical
      }

      // Run codegen
      setPipelineStages((stages) => updateStageStatus(stages, "codegen", { status: "running" }));
      addLog("info", "Starting component generation...", "codegen");

      const codegenResponse = await fetch("/api/codegen/v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: result.runId,
          setSlug: slug,
        }),
      });

      if (!codegenResponse.ok) {
        const errBody = await codegenResponse.json().catch(() => ({}));
        throw new Error(errBody.message || `Codegen failed: ${codegenResponse.status}`);
      }

      const codegenData: CodegenResponse = await codegenResponse.json();
      setCodegenResult(codegenData);

      setPipelineStages((stages) => updateStageStatus(stages, "codegen", {
        status: "complete",
        latencyMs: codegenData.latencyMs,
      }));

      addLog("info", `Codegen complete: ${codegenData.progress.complete}/${codegenData.progress.total} components`, "codegen");

      if (codegenData.errors.length > 0) {
        addLog("warn", `${codegenData.errors.length} components failed`, "codegen");
      }

      const totalTime = Date.now() - startTime;
      addLog("info", `Library generated in ${(totalTime / 1000).toFixed(1)}s`, "codegen");

    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      addLog("error", message);

      // Mark current stage as failed
      setPipelineStages((stages) => {
        const runningStage = stages.find((s) => s.status === "running");
        if (runningStage) {
          return updateStageStatus(stages, runningStage.id, { status: "failed", error: message });
        }
        return stages;
      });
    } finally {
      setIsRunningPipeline(false);
    }
  }, [images, setSlug, addLog]);

  const selectedElement = selectedElementId
    ? currentElements.find((e) => e.id === selectedElementId)
    : null;

  const replicateConfigured = health?.services?.replicate === "configured";

  // Calculate total elements across all images
  const totalElements = useMemo(() => {
    let count = 0;
    for (const elements of elementsMap.values()) {
      count += elements.length;
    }
    return count;
  }, [elementsMap]);

  const isPipelineComplete = pipelineResult !== null;
  const canGenerateLibrary = images.length > 0 && setSlug.trim() && !isRunningPipeline;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-ink-primary">
          Workspace
        </h1>
        <p className="mt-1 text-ink-secondary">
          Upload screenshots, run the pipeline, and generate component libraries.
        </p>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-4 text-sm">
        {health ? (
          <span className={replicateConfigured ? "text-success" : "text-warning"}>
            <span className="inline-block w-2 h-2 rounded-full bg-current mr-2" />
            OmniParser: {replicateConfigured ? "Ready" : "Not configured"}
          </span>
        ) : (
          <span className="text-ink-muted animate-pulse">Checking pipeline...</span>
        )}
        {totalElements > 0 && (
          <span className="text-ink-muted">
            {totalElements} elements detected
          </span>
        )}
      </div>

      {/* Image Set Header (when images uploaded) */}
      {images.length > 0 && (
        <ImageSetHeader
          images={images}
          createdAt={createdAt}
          styleRunId={styleRunId || undefined}
          runId={pipelineResult?.runId}
          isLoading={isRunningPipeline}
          replicateConfigured={replicateConfigured}
        />
      )}

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Image viewer / Results */}
        <div className="lg:col-span-2 space-y-4">
          {/* Upload area (when no images) */}
          {images.length === 0 && (
            <Card>
              <ImageUploader onImagesAdded={handleImagesAdded} disabled={isRunningPipeline} />
            </Card>
          )}

          {/* View mode tabs */}
          {images.length > 0 && (
            <div className="flex items-center gap-2 border-b border-studio-border pb-2">
              {[
                { id: "grid" as ViewMode, label: "Images", icon: "grid" },
                { id: "overlay" as ViewMode, label: "Overlay", icon: "layers", disabled: !currentImage },
                { id: "crops" as ViewMode, label: "Auto-Crops", icon: "crop", disabled: autoCrops.length === 0 },
                { id: "style" as ViewMode, label: "Style Guide", icon: "palette", disabled: !styleTokens },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setViewMode(tab.id)}
                  disabled={tab.disabled}
                  className={`
                    px-3 py-1.5 text-sm rounded-lg transition-colors
                    ${viewMode === tab.id
                      ? "bg-accent text-white"
                      : "text-ink-muted hover:text-ink-primary hover:bg-studio-surface"
                    }
                    ${tab.disabled ? "opacity-50 cursor-not-allowed" : ""}
                  `}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* Grid view */}
          {images.length > 0 && viewMode === "grid" && (
            <Card>
              <ImageThumbnailGrid
                images={images}
                elementsMap={elementsMap}
                currentIndex={currentIndex}
                onSelectImage={handleSelectImage}
                parseStatus={new Map(Array.from(imageStageStatuses.entries()).map(([id, status]) => [id, status.parseStatus]))}
              />

              {/* Current image preview */}
              {currentImage && (
                <div className="mt-4 pt-4 border-t border-studio-border">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-ink-primary">
                        {currentImage.filename}
                      </span>
                      <span className="text-xs text-ink-muted">
                        {currentImage.naturalWidth}×{currentImage.naturalHeight}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleRunOmniParser}
                        disabled={isRunningPipeline || !replicateConfigured}
                        className="btn-secondary text-xs"
                      >
                        Parse Image
                      </button>
                      <button
                        onClick={handleRemoveImage}
                        disabled={isRunningPipeline}
                        className="btn-ghost text-xs text-danger"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="bg-studio-bg rounded-lg p-2">
                    <BoundingBoxOverlay
                      image={currentImage}
                      elements={currentElements}
                      selectedId={selectedElementId}
                      onSelectElement={handleSelectElement}
                    />
                  </div>

                  {currentElements.length > 0 && (
                    <p className="text-xs text-ink-muted mt-2">
                      {currentElements.length} elements • Click to select
                    </p>
                  )}
                </div>
              )}
            </Card>
          )}

          {/* Overlay view */}
          {images.length > 0 && viewMode === "overlay" && currentImage && (
            <Card>
              <OmniParserOverlayViewer
                image={currentImage}
                elements={currentElements}
                onClose={() => setViewMode("grid")}
              />
            </Card>
          )}

          {/* Auto-crops view */}
          {viewMode === "crops" && (
            <Card>
              <AutoCropGallery crops={autoCrops} />
            </Card>
          )}

          {/* Style guide view */}
          {viewMode === "style" && styleTokens && (
            <Card>
              <StyleGuidePreview
                tokens={styleTokens}
                tokensHash={tokensHash}
                styleRunId={styleRunId}
              />
            </Card>
          )}

          {/* Add more images */}
          {images.length > 0 && (
            <Card padding="sm">
              <ImageUploader
                onImagesAdded={handleImagesAdded}
                disabled={isRunningPipeline}
                compact
              />
            </Card>
          )}
        </div>

        {/* Right: Sidebar */}
        <div className="space-y-4">
          {/* Selection details */}
          {selectedElement && (
            <Card>
              <CardHeader title="Selected Element" />
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-ink-muted">Type:</span>{" "}
                  <span className="text-ink-primary font-medium">
                    {selectedElement.type ?? "unknown"}
                  </span>
                </div>
                {selectedElement.text && (
                  <div>
                    <span className="text-ink-muted">Text:</span>{" "}
                    <span className="text-ink-primary">{selectedElement.text}</span>
                  </div>
                )}
                <div>
                  <span className="text-ink-muted">Confidence:</span>{" "}
                  <span className="text-ink-primary font-mono">
                    {selectedElement.confidence?.toFixed(3) ?? "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-ink-muted">BBox (px):</span>
                  <pre className="mt-1 p-3 bg-studio-bg rounded-lg text-2xs font-mono text-ink-secondary">
{`x: ${Math.round(selectedElement.bbox.x)}
y: ${Math.round(selectedElement.bbox.y)}
w: ${Math.round(selectedElement.bbox.width)}
h: ${Math.round(selectedElement.bbox.height)}`}
                  </pre>
                </div>
              </div>
            </Card>
          )}

          {/* Pipeline control */}
          {images.length > 0 && (
            <Card>
              <CardHeader title="Generate Library" />
              <div className="space-y-4">
                {/* Set slug input */}
                <div>
                  <label className="block text-xs text-ink-muted mb-1">
                    Package name
                  </label>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-ink-muted">ui-</span>
                    <input
                      type="text"
                      value={setSlug}
                      onChange={(e) => setSetSlug(e.target.value)}
                      placeholder="my-app"
                      disabled={isRunningPipeline}
                      className="flex-1 px-2 py-1.5 bg-studio-bg border border-studio-border rounded text-sm text-ink-primary font-mono"
                    />
                  </div>
                </div>

                {/* Generate button */}
                <button
                  onClick={handleRunPipeline}
                  disabled={!canGenerateLibrary || !replicateConfigured}
                  className="w-full btn-primary"
                >
                  {isRunningPipeline ? "Running Pipeline..." : "Run Pipeline & Generate"}
                </button>

                {/* Pipeline timeline */}
                {(isRunningPipeline || isPipelineComplete) && (
                  <PipelineTimeline
                    stages={pipelineStages}
                    logs={pipelineLogs}
                    currentStage={pipelineStages.find((s) => s.status === "running")?.id}
                    error={error ?? undefined}
                  />
                )}
              </div>
            </Card>
          )}

          {/* Results summary */}
          {codegenResult && (
            <Card>
              <CardHeader title="Library Generated" />
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-ink-muted">Package:</span>
                  <p className="font-mono text-accent">
                    @boxybop/ui-{setSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-")}
                  </p>
                </div>
                <div>
                  <span className="text-ink-muted">Components:</span>{" "}
                  <span className="text-ink-primary">
                    {codegenResult.progress.complete}/{codegenResult.progress.total}
                  </span>
                  {codegenResult.progress.failed > 0 && (
                    <span className="text-danger ml-2">
                      ({codegenResult.progress.failed} failed)
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-ink-muted">Path:</span>
                  <p className="font-mono text-2xs text-ink-secondary break-all">
                    {codegenResult.packagePath}
                  </p>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => window.open("http://localhost:6006", "_blank")}
                    className="btn-secondary text-xs flex-1"
                  >
                    Open Storybook
                  </button>
                </div>
              </div>
            </Card>
          )}

          {/* Per-image status table */}
          {images.length > 0 && imageStageStatuses.size > 0 && (
            <Card>
              <CardHeader title="Image Status" />
              <ImageStageTable
                images={images}
                stageStatuses={imageStageStatuses}
                elementsMap={elementsMap}
                onViewOverlay={(imageId) => {
                  const idx = images.findIndex((img) => img.id === imageId);
                  if (idx >= 0) {
                    setCurrentIndex(idx);
                    setViewMode("overlay");
                  }
                }}
              />
            </Card>
          )}

          {/* Error display */}
          {error && !isRunningPipeline && (
            <Card className="bg-danger/5 border-danger/20">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-danger flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-danger">Error</p>
                  <p className="text-xs text-danger/80 mt-1">{error}</p>
                  <button
                    onClick={() => setError(null)}
                    className="text-xs text-danger/70 hover:text-danger mt-2"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
