import { useCallback, useEffect, useState } from "react";
import { ImageUploader } from "./components/ImageUploader";
import { BoundingBoxOverlay } from "./components/BoundingBoxOverlay";
import { CropEditor } from "./components/CropEditor";
import { generateCrop } from "./lib/cropGenerator";
import type {
  StudioImage,
  DetectedElement,
  ParseResult,
  CropSpec,
  CropArtifact,
  BBox,
} from "./types/studio";

interface HealthStatus {
  status: string;
  services: {
    replicate: string;
  };
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function App() {
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
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);

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

      console.log(
        `[Studio] Parsed ${result.elements.length} elements for ${currentImage.filename}`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      console.error("[Studio] Parse error:", err);
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

    // Use element's bbox as initial crop region
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
      // Generate crop artifact using canvas
      const cropResult = await generateCrop(currentImage.dataUrl, currentCropRegion);

      // Create CropSpec
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

      // Create CropArtifact
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

      // Store crop and artifact
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

      console.log(`[Studio] Created crop ${cropSpecId}:`, {
        region: currentCropRegion,
        dimensions: cropResult.dimensions,
        sha256: cropResult.sha256.slice(0, 16) + "...",
      });

      // Exit crop mode
      setCropMode(false);
      setCurrentCropRegion(null);
      setSelectedElementId(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Crop failed";
      setError(message);
      console.error("[Studio] Crop error:", err);
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
    <div style={{ fontFamily: "system-ui, sans-serif", padding: "1.5rem", maxWidth: 1400, margin: "0 auto" }}>
      <header style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0 }}>BoxyBop Studio</h1>
        <p style={{ margin: "0.5rem 0 0", color: "#888" }}>
          Upload screenshots, detect UI elements, create crops
        </p>
      </header>

      {/* Status bar */}
      <div style={{ marginBottom: "1rem", fontSize: "0.875rem" }}>
        {health ? (
          <span style={{ color: replicateConfigured ? "#4ade80" : "#f97316" }}>
            OmniParser: {replicateConfigured ? "Ready" : "Not configured"}
          </span>
        ) : (
          <span style={{ color: "#888" }}>Checking pipeline...</span>
        )}
      </div>

      {/* Main layout */}
      <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start" }}>
        {/* Left: Image viewer / Crop editor */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {currentImage ? (
            <div>
              {/* Navigation */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginBottom: "0.75rem",
                }}
              >
                <button
                  onClick={handlePrevImage}
                  disabled={currentIndex === 0 || cropMode}
                  style={{ padding: "0.25rem 0.5rem" }}
                >
                  Prev
                </button>
                <span style={{ color: "#888" }}>
                  {currentIndex + 1} / {images.length}
                </span>
                <button
                  onClick={handleNextImage}
                  disabled={currentIndex >= images.length - 1 || cropMode}
                  style={{ padding: "0.25rem 0.5rem" }}
                >
                  Next
                </button>
                <span style={{ flex: 1 }} />
                <button
                  onClick={handleRemoveImage}
                  disabled={cropMode}
                  style={{ padding: "0.25rem 0.5rem", color: "#f87171" }}
                >
                  Remove
                </button>
              </div>

              {/* Image viewer or Crop editor */}
              <div
                style={{
                  backgroundColor: "#1a1a1a",
                  padding: "0.5rem",
                  borderRadius: "8px",
                }}
              >
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
                <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <button
                    onClick={handleRunOmniParser}
                    disabled={isLoading || !replicateConfigured}
                    style={{
                      padding: "0.5rem 1rem",
                      backgroundColor: "#3b82f6",
                      color: "#fff",
                      border: "none",
                      borderRadius: "4px",
                      cursor: isLoading || !replicateConfigured ? "not-allowed" : "pointer",
                      opacity: isLoading || !replicateConfigured ? 0.5 : 1,
                    }}
                  >
                    {isLoading ? "Processing..." : "Run OmniParser"}
                  </button>
                  {selectedElement && (
                    <button
                      onClick={handleStartCrop}
                      disabled={isLoading}
                      style={{
                        padding: "0.5rem 1rem",
                        backgroundColor: "#22c55e",
                        color: "#fff",
                        border: "none",
                        borderRadius: "4px",
                        cursor: isLoading ? "not-allowed" : "pointer",
                        opacity: isLoading ? 0.5 : 1,
                      }}
                    >
                      Edit Crop
                    </button>
                  )}
                  {currentElements.length > 0 && (
                    <span style={{ alignSelf: "center", color: "#888" }}>
                      {currentElements.length} elements
                    </span>
                  )}
                  {currentCrops.length > 0 && (
                    <span style={{ alignSelf: "center", color: "#4ade80" }}>
                      {currentCrops.length} crops
                    </span>
                  )}
                </div>
              )}

              {error && (
                <p style={{ color: "#f87171", marginTop: "0.5rem" }}>{error}</p>
              )}
            </div>
          ) : (
            <ImageUploader onImagesAdded={handleImagesAdded} disabled={isLoading} />
          )}

          {/* Add more images */}
          {images.length > 0 && !cropMode && (
            <div style={{ marginTop: "1rem" }}>
              <ImageUploader onImagesAdded={handleImagesAdded} disabled={isLoading} />
            </div>
          )}
        </div>

        {/* Right: Sidebar */}
        <div
          style={{
            width: 300,
            flexShrink: 0,
            backgroundColor: "#1a1a1a",
            padding: "1rem",
            borderRadius: "8px",
          }}
        >
          {/* Selection details */}
          <h3 style={{ margin: "0 0 0.75rem" }}>Selection</h3>
          {selectedElement && !cropMode ? (
            <div style={{ fontSize: "0.875rem" }}>
              <p style={{ margin: "0 0 0.5rem" }}>
                <strong>Type:</strong> {selectedElement.type ?? "unknown"}
              </p>
              {selectedElement.text && (
                <p style={{ margin: "0 0 0.5rem" }}>
                  <strong>Text:</strong> {selectedElement.text}
                </p>
              )}
              <p style={{ margin: "0 0 0.5rem" }}>
                <strong>Confidence:</strong>{" "}
                {selectedElement.confidence?.toFixed(3) ?? "N/A"}
              </p>
              <p style={{ margin: "0 0 0.5rem" }}>
                <strong>BBox (px):</strong>
              </p>
              <pre
                style={{
                  margin: 0,
                  padding: "0.5rem",
                  backgroundColor: "#000",
                  borderRadius: "4px",
                  fontSize: "0.75rem",
                  overflow: "auto",
                }}
              >
{`x: ${selectedElement.bbox.x}
y: ${selectedElement.bbox.y}
w: ${selectedElement.bbox.width}
h: ${selectedElement.bbox.height}`}
              </pre>
            </div>
          ) : cropMode && currentCropRegion ? (
            <div style={{ fontSize: "0.875rem" }}>
              <p style={{ margin: "0 0 0.5rem", color: "#4ade80" }}>
                Editing crop region
              </p>
              <p style={{ margin: "0 0 0.5rem" }}>
                <strong>Region (px):</strong>
              </p>
              <pre
                style={{
                  margin: 0,
                  padding: "0.5rem",
                  backgroundColor: "#000",
                  borderRadius: "4px",
                  fontSize: "0.75rem",
                  overflow: "auto",
                }}
              >
{`x: ${Math.round(currentCropRegion.x)}
y: ${Math.round(currentCropRegion.y)}
w: ${Math.round(currentCropRegion.width)}
h: ${Math.round(currentCropRegion.height)}`}
              </pre>
            </div>
          ) : (
            <p style={{ color: "#666", margin: 0 }}>
              Select an element to create a crop
            </p>
          )}

          {/* Crop previews */}
          {currentCrops.length > 0 && (
            <div style={{ marginTop: "1.5rem" }}>
              <h4 style={{ margin: "0 0 0.5rem" }}>Crops ({currentCrops.length})</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {currentCrops.map((crop) => {
                  const artifact = artifacts.get(crop.id);
                  return (
                    <div
                      key={crop.id}
                      style={{
                        display: "flex",
                        gap: "0.5rem",
                        padding: "0.5rem",
                        backgroundColor: "#000",
                        borderRadius: "4px",
                      }}
                    >
                      {artifact && (
                        <img
                          src={artifact.dataUrl}
                          alt={`Crop ${crop.id}`}
                          style={{
                            width: 60,
                            height: 60,
                            objectFit: "contain",
                            backgroundColor: "#333",
                            borderRadius: "2px",
                          }}
                        />
                      )}
                      <div style={{ fontSize: "0.75rem", overflow: "hidden" }}>
                        <p style={{ margin: "0 0 0.25rem" }}>
                          {artifact?.dimensions.width} × {artifact?.dimensions.height}
                        </p>
                        <p style={{ margin: 0, color: "#666" }}>
                          {artifact?.fileSizeBytes
                            ? `${(artifact.fileSizeBytes / 1024).toFixed(1)} KB`
                            : ""}
                        </p>
                        <p
                          style={{
                            margin: "0.25rem 0 0",
                            color: "#888",
                            fontSize: "0.65rem",
                            fontFamily: "monospace",
                          }}
                        >
                          {artifact?.contentHash.slice(0, 12)}...
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Image thumbnails */}
          {images.length > 1 && (
            <div style={{ marginTop: "1.5rem" }}>
              <h4 style={{ margin: "0 0 0.5rem" }}>Images</h4>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {images.map((img, idx) => (
                  <div
                    key={img.id}
                    onClick={() => {
                      if (!cropMode) {
                        setCurrentIndex(idx);
                        setSelectedElementId(null);
                      }
                    }}
                    style={{
                      width: 48,
                      height: 48,
                      border:
                        idx === currentIndex
                          ? "2px solid #3b82f6"
                          : "2px solid transparent",
                      borderRadius: "4px",
                      overflow: "hidden",
                      cursor: cropMode ? "not-allowed" : "pointer",
                      opacity: cropMode ? 0.5 : 1,
                    }}
                  >
                    <img
                      src={img.dataUrl}
                      alt={img.filename}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
