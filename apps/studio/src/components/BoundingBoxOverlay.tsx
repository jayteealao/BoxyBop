import { useCallback, useEffect, useRef, useState } from "react";
import type { StudioImage, DetectedElement } from "../types/studio";

interface BoundingBoxOverlayProps {
  image: StudioImage;
  elements: DetectedElement[];
  selectedId: string | null;
  onSelectElement: (id: string | null) => void;
}

/**
 * Renders an image with bounding box overlays.
 * All coordinates are in ORIGINAL pixel space and converted to display space for rendering.
 * Overlays stay aligned on window resize.
 */
export function BoundingBoxOverlay({
  image,
  elements,
  selectedId,
  onSelectElement,
}: BoundingBoxOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });

  // Track displayed image size on mount and resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const img = container.querySelector("img");
      if (img) {
        setDisplaySize({
          width: img.clientWidth,
          height: img.clientHeight,
        });
      }
    };

    // Initial size after image loads
    const img = container.querySelector("img");
    if (img) {
      if (img.complete) {
        updateSize();
      } else {
        img.onload = updateSize;
      }
    }

    // Update on resize
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, [image.id]);

  // Convert original pixel coords to display coords
  const toDisplayCoords = useCallback(
    (original: { x: number; y: number; width: number; height: number }) => {
      if (displaySize.width === 0 || displaySize.height === 0) {
        return { x: 0, y: 0, width: 0, height: 0 };
      }

      const scaleX = displaySize.width / image.naturalWidth;
      const scaleY = displaySize.height / image.naturalHeight;

      return {
        x: original.x * scaleX,
        y: original.y * scaleY,
        width: original.width * scaleX,
        height: original.height * scaleY,
      };
    },
    [displaySize, image.naturalWidth, image.naturalHeight]
  );

  const handleBoxClick = useCallback(
    (e: React.MouseEvent, elementId: string) => {
      e.stopPropagation();
      onSelectElement(selectedId === elementId ? null : elementId);
    },
    [selectedId, onSelectElement]
  );

  const handleBackgroundClick = useCallback(() => {
    onSelectElement(null);
  }, [onSelectElement]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        display: "inline-block",
        maxWidth: "100%",
      }}
      onClick={handleBackgroundClick}
    >
      <img
        src={image.dataUrl}
        alt={image.filename}
        style={{
          display: "block",
          maxWidth: "100%",
          height: "auto",
        }}
      />

      {/* Overlay container - matches image size */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: displaySize.width || "100%",
          height: displaySize.height || "100%",
          pointerEvents: "none",
        }}
      >
        {elements.map((element) => {
          const display = toDisplayCoords(element.bbox);
          const isSelected = element.id === selectedId;

          return (
            <div
              key={element.id}
              onClick={(e) => handleBoxClick(e, element.id)}
              style={{
                position: "absolute",
                left: display.x,
                top: display.y,
                width: display.width,
                height: display.height,
                border: `2px solid ${isSelected ? "#00ff00" : "#ff6600"}`,
                backgroundColor: isSelected
                  ? "rgba(0, 255, 0, 0.15)"
                  : "rgba(255, 102, 0, 0.1)",
                cursor: "pointer",
                pointerEvents: "auto",
                boxSizing: "border-box",
                transition: "border-color 0.15s, background-color 0.15s",
              }}
              title={`${element.type || "element"} (${element.confidence?.toFixed(2) ?? "?"})`}
            >
              {/* Label badge */}
              {element.type && (
                <span
                  style={{
                    position: "absolute",
                    top: -20,
                    left: 0,
                    fontSize: "11px",
                    padding: "2px 4px",
                    backgroundColor: isSelected ? "#00ff00" : "#ff6600",
                    color: "#000",
                    borderRadius: "2px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {element.type}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Dimensions info */}
      <div
        style={{
          position: "absolute",
          bottom: 4,
          right: 4,
          fontSize: "11px",
          padding: "2px 6px",
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          color: "#fff",
          borderRadius: "2px",
        }}
      >
        {image.naturalWidth} × {image.naturalHeight}
      </div>
    </div>
  );
}
