/**
 * Workspace Page - Upload images, detect elements, create crops, generate library.
 *
 * This is the refactored version of the original App.tsx functionality,
 * now using Tailwind CSS and consistent UI patterns.
 */

import { useCallback, useEffect, useState } from "react";
import { Card, CardHeader } from "../components/ui";
import { ImageUploader } from "../components/ImageUploader";
import { BoundingBoxOverlay } from "../components/BoundingBoxOverlay";
import { CropEditor } from "../components/CropEditor";
import { GenerateLibraryPanel } from "../components/GenerateLibraryPanel";
import { generateCrop } from "../lib/cropGenerator";
import type {
  StudioImage,
  DetectedElement,
  ParseResult,
  CropSpec,
  CropArtifact,
  BBox,
} from "../types/studio";

interface HealthStatus {
  status: string;
  services: {
    replicate: string;
    gemini?: string;
    anthropic?: string;
  };
}

interface StyleAnalysisResult {
  styleRunId: string;
  geminiAnalysisId: string;
  lockedStyleGuideId: string;
  latency: {
    geminiMs: number;
    claudeMs: number;
    totalMs: number;
  };
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function WorkspacePage() {
  // Images state
  const [images, setImages] = useState<StudioImage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Elements per image
  const [elementsMap, setElementsMap] = useState<Map<string, DetectedElement[]>>(
    new Map()
  );

  // Selection
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  // Crop state
  const [cropMode, setCropMode] = useState(false);
  const [currentCropRegion, setCurrentCropRegion] = useState<BBox | null>(null);
  const [crops, setCrops] = useState<Map<string, CropSpec[]>>(new Map());
  const [artifacts, setArtifacts] = useState<Map<string, CropArtifact>>(new Map());

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isAnalyzingStyle, _setIsAnalyzingStyle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [styleAnalysis, _setStyleAnalysis] = useState<StyleAnalysisResult | null>(null);

  // Check health on mount
  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  const currentImage = images[currentIndex] ?? null;
  const currentElements = currentImage
    ? elementsMap.get(currentImage.id) ?? []
    : [];
  const currentCrops = currentImage ? crops.get(currentImage.id) ?? [] : [];

  const handleImagesAdded = useCallback((newImages: StudioImage[]) => {
    setImages((prev) => [...prev, ...newImages]);
    setError(null);
  }, []);

  const handleRunOmniParser = useCallback(async () => {
    if (!currentImage) return;

    setIsLoading(true);
    setError(null);
    setSelectedElementId(null);
    setCropMode(false);

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
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [currentImage]);

  const handleSelectElement = useCallback((id: string | null) => {
    setSelectedElementId(id);
    setCropMode(false);
  }, []);

  const handleStartCrop = useCallback(() => {
    if (!selectedElementId || !currentImage) return;

    const element = currentElements.find((e) => e.id === selectedElementId);
    if (!element) return;

    setCurrentCropRegion({ ...element.bbox });
    setCropMode(true);
  }, [selectedElementId, currentElements, currentImage]);

  const handleCropRegionChange = useCallback((region: BBox) => {
    setCurrentCropRegion(region);
  }, []);

  const handleCropCancel = useCallback(() => {
    setCropMode(false);
    setCurrentCropRegion(null);
  }, []);

  const handleCropConfirm = useCallback(async () => {
    if (!currentImage || !currentCropRegion) return;

    setIsLoading(true);
    setError(null);

    try {
      const cropResult = await generateCrop(currentImage.dataUrl, currentCropRegion);

      const cropSpecId = `crop-${generateId()}`;
      const now = new Date().toISOString();

      const spec: CropSpec = {
        id: cropSpecId,
        imageId: currentImage.id,
        sourceElementId: selectedElementId ?? undefined,
        region: currentCropRegion,
        humanAdjusted: true,
        updatedAt: now,
      };

      const artifact: CropArtifact = {
        id: `artifact-${generateId()}`,
        cropSpecId,
        sourceImageId: currentImage.id,
        pngBase64: cropResult.pngBase64,
        dataUrl: cropResult.dataUrl,
        contentHash: cropResult.sha256,
        dimensions: cropResult.dimensions,
        fileSizeBytes: cropResult.sizeBytes,
        createdAt: now,
      };

      setCrops((prev) => {
        const next = new Map(prev);
        const existing = next.get(currentImage.id) ?? [];
        next.set(currentImage.id, [...existing, spec]);
        return next;
      });

      setArtifacts((prev) => {
        const next = new Map(prev);
        next.set(cropSpecId, artifact);
        return next;
      });

      setCropMode(false);
      setCurrentCropRegion(null);
      setSelectedElementId(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Crop failed";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [currentImage, currentCropRegion, selectedElementId]);

  const handlePrevImage = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1));
    setSelectedElementId(null);
    setCropMode(false);
  }, []);

  const handleNextImage = useCallback(() => {
    setCurrentIndex((i) => Math.min(images.length - 1, i + 1));
    setSelectedElementId(null);
    setCropMode(false);
  }, [images.length]);

  const handleRemoveImage = useCallback(() => {
    if (!currentImage) return;
    setImages((prev) => prev.filter((img) => img.id !== currentImage.id));
    setElementsMap((prev) => {
      const next = new Map(prev);
      next.delete(currentImage.id);
      return next;
    });
    setCrops((prev) => {
      const next = new Map(prev);
      next.delete(currentImage.id);
      return next;
    });
    setCurrentIndex((i) => Math.max(0, i - 1));
    setSelectedElementId(null);
    setCropMode(false);
  }, [currentImage]);

  const selectedElement = selectedElementId
    ? currentElements.find((e) => e.id === selectedElementId)
    : null;

  const replicateConfigured = health?.services?.replicate === "configured";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-ink-primary">
          Workspace
        </h1>
        <p className="mt-1 text-ink-secondary">
          Upload screenshots, detect UI elements, and generate component libraries.
        </p>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-4 text-sm">
        {health ? (
          <span
            className={
              replicateConfigured ? "text-success" : "text-warning"
            }
          >
            <span className="inline-block w-2 h-2 rounded-full bg-current mr-2" />
            OmniParser: {replicateConfigured ? "Ready" : "Not configured"}
          </span>
        ) : (
          <span className="text-ink-muted animate-pulse">
            Checking pipeline...
          </span>
        )}
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Image viewer / Crop editor */}
        <div className="lg:col-span-2 space-y-4">
          {currentImage ? (
            <Card padding="sm">
              {/* Navigation */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrevImage}
                    disabled={currentIndex === 0 || cropMode}
                    className="btn-ghost px-3 py-1.5 text-sm"
                  >
                    Prev
                  </button>
                  <span className="text-sm text-ink-muted font-mono">
                    {currentIndex + 1} / {images.length}
                  </span>
                  <button
                    onClick={handleNextImage}
                    disabled={currentIndex >= images.length - 1 || cropMode}
                    className="btn-ghost px-3 py-1.5 text-sm"
                  >
                    Next
                  </button>
                </div>
                <button
                  onClick={handleRemoveImage}
                  disabled={cropMode}
                  className="btn-danger px-3 py-1.5 text-sm"
                >
                  Remove
                </button>
              </div>

              {/* Image viewer */}
              <div className="bg-studio-bg rounded-lg p-2">
                {cropMode && currentCropRegion ? (
                  <CropEditor
                    image={currentImage}
                    initialRegion={currentCropRegion}
                    onRegionChange={handleCropRegionChange}
                    onCancel={handleCropCancel}
                    onConfirm={handleCropConfirm}
                  />
                ) : (
                  <BoundingBoxOverlay
                    image={currentImage}
                    elements={currentElements}
                    selectedId={selectedElementId}
                    onSelectElement={handleSelectElement}
                  />
                )}
              </div>

              {/* Actions */}
              {!cropMode && (
                <div className="flex items-center gap-3 mt-4 flex-wrap">
                  <button
                    onClick={handleRunOmniParser}
                    disabled={isLoading || isAnalyzingStyle || !replicateConfigured}
                    className="btn-primary"
                  >
                    {isLoading ? "Processing..." : "Run OmniParser"}
                  </button>
                  {selectedElement && (
                    <button
                      onClick={handleStartCrop}
                      disabled={isLoading}
                      className="btn-secondary"
                    >
                      Edit Crop
                    </button>
                  )}
                  {currentElements.length > 0 && (
                    <span className="text-sm text-ink-muted">
                      {currentElements.length} elements
                    </span>
                  )}
                  {currentCrops.length > 0 && (
                    <span className="text-sm text-success">
                      {currentCrops.length} crops
                    </span>
                  )}
                </div>
              )}

              {error && (
                <div className="mt-4 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">
                  {error}
                </div>
              )}
            </Card>
          ) : (
            <Card>
              <ImageUploader onImagesAdded={handleImagesAdded} disabled={isLoading} />
            </Card>
          )}

          {/* Add more images */}
          {images.length > 0 && !cropMode && (
            <Card padding="sm">
              <ImageUploader onImagesAdded={handleImagesAdded} disabled={isLoading} />
            </Card>
          )}
        </div>

        {/* Right: Sidebar */}
        <div className="space-y-4">
          {/* Selection details */}
          <Card>
            <CardHeader title="Selection" />
            {selectedElement && !cropMode ? (
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
{`x: ${selectedElement.bbox.x}
y: ${selectedElement.bbox.y}
w: ${selectedElement.bbox.width}
h: ${selectedElement.bbox.height}`}
                  </pre>
                </div>
              </div>
            ) : cropMode && currentCropRegion ? (
              <div className="space-y-3 text-sm">
                <p className="text-success font-medium">Editing crop region</p>
                <div>
                  <span className="text-ink-muted">Region (px):</span>
                  <pre className="mt-1 p-3 bg-studio-bg rounded-lg text-2xs font-mono text-ink-secondary">
{`x: ${Math.round(currentCropRegion.x)}
y: ${Math.round(currentCropRegion.y)}
w: ${Math.round(currentCropRegion.width)}
h: ${Math.round(currentCropRegion.height)}`}
                  </pre>
                </div>
              </div>
            ) : (
              <p className="text-sm text-ink-muted">
                Select an element to create a crop
              </p>
            )}
          </Card>

          {/* Crop previews */}
          {currentCrops.length > 0 && (
            <Card>
              <CardHeader title={`Crops (${currentCrops.length})`} />
              <div className="space-y-2">
                {currentCrops.map((crop) => {
                  const artifact = artifacts.get(crop.id);
                  return (
                    <div
                      key={crop.id}
                      className="flex gap-3 p-2 bg-studio-bg rounded-lg"
                    >
                      {artifact && (
                        <img
                          src={artifact.dataUrl}
                          alt={`Crop ${crop.id}`}
                          className="w-14 h-14 object-contain bg-studio-surface rounded"
                        />
                      )}
                      <div className="text-2xs overflow-hidden">
                        <p className="text-ink-primary">
                          {artifact?.dimensions.width} × {artifact?.dimensions.height}
                        </p>
                        <p className="text-ink-muted">
                          {artifact?.fileSizeBytes
                            ? `${(artifact.fileSizeBytes / 1024).toFixed(1)} KB`
                            : ""}
                        </p>
                        <p className="text-ink-disabled font-mono truncate">
                          {artifact?.contentHash.slice(0, 12)}...
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Style Analysis Result */}
          {styleAnalysis && (
            <Card>
              <CardHeader title="Style Analysis" />
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-ink-muted">Run ID:</span>
                  <p className="text-2xs font-mono text-ink-secondary break-all">
                    {styleAnalysis.styleRunId}
                  </p>
                </div>
                <div>
                  <span className="text-ink-muted">Latency:</span>
                  <ul className="mt-1 text-2xs text-ink-secondary space-y-1">
                    <li>Gemini: {styleAnalysis.latency.geminiMs}ms</li>
                    <li>Claude: {styleAnalysis.latency.claudeMs}ms</li>
                    <li>Total: {styleAnalysis.latency.totalMs}ms</li>
                  </ul>
                </div>
                <p className="text-success text-sm font-medium">Tokens locked</p>
              </div>
            </Card>
          )}

          {/* Generate Library Panel */}
          {images.length > 0 && (
            <GenerateLibraryPanel
              images={images}
              crops={crops}
              disabled={isLoading || isAnalyzingStyle}
            />
          )}

          {/* Image thumbnails */}
          {images.length > 1 && (
            <Card>
              <CardHeader title="Images" />
              <div className="flex flex-wrap gap-2">
                {images.map((img, idx) => (
                  <button
                    key={img.id}
                    onClick={() => {
                      if (!cropMode) {
                        setCurrentIndex(idx);
                        setSelectedElementId(null);
                      }
                    }}
                    disabled={cropMode}
                    className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                      idx === currentIndex
                        ? "border-accent shadow-glow-sm"
                        : "border-transparent hover:border-studio-border-accent"
                    } ${cropMode ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <img
                      src={img.dataUrl}
                      alt={img.filename}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
