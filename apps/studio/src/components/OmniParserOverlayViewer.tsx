/**
 * OmniParser Overlay Viewer - Read-only viewer for detected elements.
 */

import { useEffect, useRef, useState, useMemo } from "react";
import type { StudioImage, DetectedElement, BBox } from "../types/studio";

interface OmniParserOverlayViewerProps {
  image: StudioImage;
  elements: DetectedElement[];
  onClose?: () => void;
}

function toDisplayCoords(
  bbox: BBox,
  naturalSize: { width: number; height: number },
  displaySize: { width: number; height: number }
): BBox {
  const scaleX = displaySize.width / naturalSize.width;
  const scaleY = displaySize.height / naturalSize.height;
  return {
    x: bbox.x * scaleX,
    y: bbox.y * scaleY,
    width: bbox.width * scaleX,
    height: bbox.height * scaleY,
  };
}

const typeColors: Record<string, string> = {
  button: "#3b82f6",
  input: "#8b5cf6",
  text: "#6b7280",
  image: "#10b981",
  icon: "#f59e0b",
  card: "#ec4899",
  container: "#06b6d4",
  navigation: "#84cc16",
  header: "#14b8a6",
  footer: "#a855f7",
  list: "#f97316",
  checkbox: "#6366f1",
  radio: "#6366f1",
  toggle: "#6366f1",
  dropdown: "#8b5cf6",
  modal: "#f43f5e",
  tooltip: "#64748b",
  badge: "#eab308",
  avatar: "#ec4899",
  unknown: "#94a3b8",
};

export function OmniParserOverlayViewer({
  image,
  elements,
  onClose,
}: OmniParserOverlayViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());

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

  // Get unique element types for filtering
  const elementTypes = useMemo(() => {
    const types = new Set<string>();
    elements.forEach((el) => types.add(el.type || "unknown"));
    return Array.from(types).sort();
  }, [elements]);

  // Filter elements by selected types
  const filteredElements = useMemo(() => {
    if (selectedTypes.size === 0) return elements;
    return elements.filter((el) => selectedTypes.has(el.type || "unknown"));
  }, [elements, selectedTypes]);

  const toggleType = (type: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const hoveredElement = elements.find((el) => el.id === hoveredId);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-ink-primary">
            OmniParser Results
          </h3>
          <p className="text-xs text-ink-muted">
            {elements.length} elements detected • {filteredElements.length} shown
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-ink-muted hover:text-ink-primary transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {/* Type filter chips */}
      <div className="flex flex-wrap gap-2">
        {elementTypes.map((type) => {
          const count = elements.filter((el) => (el.type || "unknown") === type).length;
          const isSelected = selectedTypes.size === 0 || selectedTypes.has(type);
          const color = typeColors[type] || typeColors.unknown;

          return (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={`
                inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-2xs transition-all
                ${isSelected
                  ? "ring-1 ring-offset-1 ring-offset-studio-bg"
                  : "opacity-50"
                }
              `}
              style={{
                backgroundColor: `${color}20`,
                color: color,
                // @ts-expect-error CSS custom property for ring color
                "--tw-ring-color": isSelected ? color : "transparent",
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: color }}
              />
              {type}
              <span className="font-mono">({count})</span>
            </button>
          );
        })}
        {selectedTypes.size > 0 && (
          <button
            onClick={() => setSelectedTypes(new Set())}
            className="text-2xs text-ink-muted hover:text-ink-primary transition-colors px-2"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Image with overlay */}
      <div
        ref={containerRef}
        className="relative inline-block max-w-full bg-studio-bg rounded-lg overflow-hidden"
      >
        <img
          src={image.dataUrl}
          alt={image.filename}
          className="block max-w-full h-auto"
        />

        {/* Bounding boxes */}
        {filteredElements.map((element) => {
          const displayBbox = toDisplayCoords(element.bbox, naturalSize, displaySize);
          const color = typeColors[element.type || "unknown"] || typeColors.unknown;
          const isHovered = element.id === hoveredId;

          return (
            <div
              key={element.id}
              onMouseEnter={() => setHoveredId(element.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                position: "absolute",
                left: displayBbox.x,
                top: displayBbox.y,
                width: displayBbox.width,
                height: displayBbox.height,
                border: `2px solid ${color}`,
                backgroundColor: isHovered ? `${color}20` : "transparent",
                transition: "background-color 0.15s",
              }}
            >
              {/* Label */}
              <div
                className="absolute -top-5 left-0 px-1 py-0.5 rounded text-2xs font-medium whitespace-nowrap"
                style={{
                  backgroundColor: color,
                  color: "#fff",
                  opacity: isHovered ? 1 : 0.7,
                }}
              >
                {element.type || "unknown"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Hovered element details */}
      {hoveredElement && (
        <div className="bg-studio-surface rounded-lg p-3 text-xs space-y-2">
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded"
              style={{ backgroundColor: typeColors[hoveredElement.type || "unknown"] }}
            />
            <span className="font-medium text-ink-primary">
              {hoveredElement.type || "unknown"}
            </span>
            {hoveredElement.confidence && (
              <span className="text-ink-muted">
                {(hoveredElement.confidence * 100).toFixed(1)}% confidence
              </span>
            )}
          </div>
          {hoveredElement.text && (
            <p className="text-ink-secondary truncate">
              Text: "{hoveredElement.text}"
            </p>
          )}
          <p className="text-ink-muted font-mono text-2xs">
            {Math.round(hoveredElement.bbox.x)}, {Math.round(hoveredElement.bbox.y)} •{" "}
            {Math.round(hoveredElement.bbox.width)}×{Math.round(hoveredElement.bbox.height)}px
          </p>
        </div>
      )}
    </div>
  );
}
