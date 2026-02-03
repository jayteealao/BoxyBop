import { useCallback, useEffect, useState } from "react";
import { ImageUploader } from "./components/ImageUploader";
import { BoundingBoxOverlay } from "./components/BoundingBoxOverlay";
import type {
  StudioImage,
  DetectedElement,
  ParseResult,
} from "./types/studio";

interface HealthStatus {
  status: string;
  services: {
    replicate: string;
  };
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

  const handleImagesAdded = useCallback((newImages: StudioImage[]) => {
    setImages((prev) => [...prev, ...newImages]);
    setError(null);
  }, []);

  const handleRunOmniParser = useCallback(async () => {
    if (!currentImage) return;

    setIsLoading(true);
    setError(null);
    setSelectedElementId(null);

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

      // Store elements for this image
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
  }, []);

  const handlePrevImage = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1));
    setSelectedElementId(null);
  }, []);

  const handleNextImage = useCallback(() => {
    setCurrentIndex((i) => Math.min(images.length - 1, i + 1));
    setSelectedElementId(null);
  }, [images.length]);

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

  const selectedElement = selectedElementId
    ? currentElements.find((e) => e.id === selectedElementId)
    : null;

  const replicateConfigured = health?.services?.replicate === "configured";

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: "1.5rem", maxWidth: 1400, margin: "0 auto" }}>
      <header style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0 }}>BoxyBop Studio</h1>
        <p style={{ margin: "0.5rem 0 0", color: "#888" }}>
          Upload screenshots, detect UI elements, adjust bounding boxes
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
        {/* Left: Image viewer */}
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
                  disabled={currentIndex === 0}
                  style={{ padding: "0.25rem 0.5rem" }}
                >
                  Prev
                </button>
                <span style={{ color: "#888" }}>
                  {currentIndex + 1} / {images.length}
                </span>
                <button
                  onClick={handleNextImage}
                  disabled={currentIndex >= images.length - 1}
                  style={{ padding: "0.25rem 0.5rem" }}
                >
                  Next
                </button>
                <span style={{ flex: 1 }} />
                <button
                  onClick={handleRemoveImage}
                  style={{ padding: "0.25rem 0.5rem", color: "#f87171" }}
                >
                  Remove
                </button>
              </div>

              {/* Image with overlays */}
              <div
                style={{
                  backgroundColor: "#1a1a1a",
                  padding: "0.5rem",
                  borderRadius: "8px",
                }}
              >
                <BoundingBoxOverlay
                  image={currentImage}
                  elements={currentElements}
                  selectedId={selectedElementId}
                  onSelectElement={handleSelectElement}
                />
              </div>

              {/* Actions */}
              <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
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
                  {isLoading ? "Parsing..." : "Run OmniParser"}
                </button>
                {currentElements.length > 0 && (
                  <span style={{ alignSelf: "center", color: "#888" }}>
                    {currentElements.length} elements detected
                  </span>
                )}
              </div>

              {error && (
                <p style={{ color: "#f87171", marginTop: "0.5rem" }}>{error}</p>
              )}
            </div>
          ) : (
            <ImageUploader onImagesAdded={handleImagesAdded} disabled={isLoading} />
          )}

          {/* Add more images */}
          {images.length > 0 && (
            <div style={{ marginTop: "1rem" }}>
              <ImageUploader onImagesAdded={handleImagesAdded} disabled={isLoading} />
            </div>
          )}
        </div>

        {/* Right: Selection details */}
        <div
          style={{
            width: 280,
            flexShrink: 0,
            backgroundColor: "#1a1a1a",
            padding: "1rem",
            borderRadius: "8px",
          }}
        >
          <h3 style={{ margin: "0 0 0.75rem" }}>Selection</h3>
          {selectedElement ? (
            <div style={{ fontSize: "0.875rem" }}>
              <p style={{ margin: "0 0 0.5rem" }}>
                <strong>ID:</strong> {selectedElement.id}
              </p>
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
                {JSON.stringify(selectedElement.bbox, null, 2)}
              </pre>
            </div>
          ) : (
            <p style={{ color: "#666", margin: 0 }}>
              Click a bounding box to see details
            </p>
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
                      setCurrentIndex(idx);
                      setSelectedElementId(null);
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
                      cursor: "pointer",
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
