import { useCallback, useEffect, useRef, useState } from "react";
import type { StudioImage } from "../types/studio";
import {
  toDisplayCoords,
  clampBBox,
  type BBox,
} from "../lib/coordinates";

interface CropEditorProps {
  image: StudioImage;
  initialRegion: BBox; // In ORIGINAL pixel coordinates
  onRegionChange: (region: BBox) => void; // Emits ORIGINAL pixel coordinates
  onCancel: () => void;
  onConfirm: () => void;
}

type DragMode = "move" | "nw" | "ne" | "sw" | "se" | null;

/**
 * Crop region editor with draggable handles.
 * Allows user to adjust crop region interactively.
 * All coordinate conversions happen internally; onRegionChange emits ORIGINAL coords.
 */
export function CropEditor({
  image,
  initialRegion,
  onRegionChange,
  onCancel,
  onConfirm,
}: CropEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [region, setRegion] = useState<BBox>(initialRegion);
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [regionStart, setRegionStart] = useState<BBox>(initialRegion);

  // Update region when initialRegion changes
  useEffect(() => {
    setRegion(initialRegion);
  }, [initialRegion]);

  // Track displayed image size
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

    const img = container.querySelector("img");
    if (img) {
      if (img.complete) updateSize();
      else img.onload = updateSize;
    }

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [image.id]);

  const naturalSize = { width: image.naturalWidth, height: image.naturalHeight };

  // Convert current region to display coordinates
  const displayRegion = toDisplayCoords(region, naturalSize, displaySize);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, mode: DragMode) => {
      e.preventDefault();
      e.stopPropagation();
      setDragMode(mode);
      setDragStart({ x: e.clientX, y: e.clientY });
      setRegionStart(region);
    },
    [region]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragMode) return;

      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;

      // Convert delta to original pixel space
      const scaleX =
        displaySize.width > 0 ? naturalSize.width / displaySize.width : 1;
      const scaleY =
        displaySize.height > 0 ? naturalSize.height / displaySize.height : 1;

      const originalDx = dx * scaleX;
      const originalDy = dy * scaleY;

      let newRegion: BBox;

      switch (dragMode) {
        case "move":
          newRegion = {
            x: regionStart.x + originalDx,
            y: regionStart.y + originalDy,
            width: regionStart.width,
            height: regionStart.height,
          };
          break;
        case "nw":
          newRegion = {
            x: regionStart.x + originalDx,
            y: regionStart.y + originalDy,
            width: regionStart.width - originalDx,
            height: regionStart.height - originalDy,
          };
          break;
        case "ne":
          newRegion = {
            x: regionStart.x,
            y: regionStart.y + originalDy,
            width: regionStart.width + originalDx,
            height: regionStart.height - originalDy,
          };
          break;
        case "sw":
          newRegion = {
            x: regionStart.x + originalDx,
            y: regionStart.y,
            width: regionStart.width - originalDx,
            height: regionStart.height + originalDy,
          };
          break;
        case "se":
          newRegion = {
            x: regionStart.x,
            y: regionStart.y,
            width: regionStart.width + originalDx,
            height: regionStart.height + originalDy,
          };
          break;
        default:
          return;
      }

      // Clamp to image bounds and ensure positive dimensions
      const clamped = clampBBox(newRegion, naturalSize);
      setRegion(clamped);
      onRegionChange(clamped);
    },
    [dragMode, dragStart, regionStart, displaySize, naturalSize, onRegionChange]
  );

  const handleMouseUp = useCallback(() => {
    setDragMode(null);
  }, []);

  // Attach global mouse listeners during drag
  useEffect(() => {
    if (dragMode) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [dragMode, handleMouseMove, handleMouseUp]);

  const handleStyle: React.CSSProperties = {
    position: "absolute",
    width: 12,
    height: 12,
    backgroundColor: "#3b82f6",
    border: "2px solid #fff",
    borderRadius: "2px",
    cursor: "pointer",
  };

  return (
    <div>
      <div
        ref={containerRef}
        style={{
          position: "relative",
          display: "inline-block",
          maxWidth: "100%",
          userSelect: "none",
        }}
      >
        <img
          src={image.dataUrl}
          alt={image.filename}
          style={{
            display: "block",
            maxWidth: "100%",
            height: "auto",
          }}
          draggable={false}
        />

        {/* Darkened overlay outside crop region */}
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
          {/* Top dark */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: displayRegion.y,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
            }}
          />
          {/* Bottom dark */}
          <div
            style={{
              position: "absolute",
              top: displayRegion.y + displayRegion.height,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
            }}
          />
          {/* Left dark */}
          <div
            style={{
              position: "absolute",
              top: displayRegion.y,
              left: 0,
              width: displayRegion.x,
              height: displayRegion.height,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
            }}
          />
          {/* Right dark */}
          <div
            style={{
              position: "absolute",
              top: displayRegion.y,
              left: displayRegion.x + displayRegion.width,
              right: 0,
              height: displayRegion.height,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
            }}
          />
        </div>

        {/* Crop region border */}
        <div
          onMouseDown={(e) => handleMouseDown(e, "move")}
          style={{
            position: "absolute",
            left: displayRegion.x,
            top: displayRegion.y,
            width: displayRegion.width,
            height: displayRegion.height,
            border: "2px dashed #3b82f6",
            boxSizing: "border-box",
            cursor: "move",
          }}
        >
          {/* Corner handles */}
          <div
            onMouseDown={(e) => handleMouseDown(e, "nw")}
            style={{ ...handleStyle, top: -6, left: -6, cursor: "nw-resize" }}
          />
          <div
            onMouseDown={(e) => handleMouseDown(e, "ne")}
            style={{ ...handleStyle, top: -6, right: -6, cursor: "ne-resize" }}
          />
          <div
            onMouseDown={(e) => handleMouseDown(e, "sw")}
            style={{ ...handleStyle, bottom: -6, left: -6, cursor: "sw-resize" }}
          />
          <div
            onMouseDown={(e) => handleMouseDown(e, "se")}
            style={{ ...handleStyle, bottom: -6, right: -6, cursor: "se-resize" }}
          />
        </div>

        {/* Region info */}
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
          Crop: {Math.round(region.width)} × {Math.round(region.height)} @ ({Math.round(region.x)}, {Math.round(region.y)})
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
        <button
          onClick={onConfirm}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#22c55e",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Create Crop
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#6b7280",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
