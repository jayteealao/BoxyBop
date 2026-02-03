/**
 * Auto-Crop Gallery - Read-only gallery of auto-generated crops.
 */

import { useMemo, useState } from "react";

export interface AutoCrop {
  id: string;
  cropSpecId: string;
  imageId: string;
  elementType: string;
  dimensions: { width: number; height: number };
  thumbnailDataUrl: string;
  label?: string;
}

interface AutoCropGalleryProps {
  crops: AutoCrop[];
  onSelectCrop?: (crop: AutoCrop) => void;
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

export function AutoCropGallery({ crops, onSelectCrop }: AutoCropGalleryProps) {
  const [filterType, setFilterType] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Get unique element types for filtering
  const elementTypes = useMemo(() => {
    const types = new Set<string>();
    crops.forEach((crop) => types.add(crop.elementType));
    return Array.from(types).sort();
  }, [crops]);

  // Filter crops by type
  const filteredCrops = useMemo(() => {
    if (!filterType) return crops;
    return crops.filter((crop) => crop.elementType === filterType);
  }, [crops, filterType]);

  // Group by image
  const imageCount = useMemo(() => {
    return new Set(crops.map((c) => c.imageId)).size;
  }, [crops]);

  const handleCropClick = (crop: AutoCrop) => {
    setSelectedId(crop.id === selectedId ? null : crop.id);
    onSelectCrop?.(crop);
  };

  if (crops.length === 0) {
    return (
      <div className="text-center py-8 text-ink-muted">
        <svg className="w-12 h-12 mx-auto mb-3 text-ink-disabled" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
        <p className="text-sm">No auto-crops generated yet</p>
        <p className="text-xs mt-1">Run the pipeline to generate crops from detected elements</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-ink-primary">
            Auto-Crops
          </h3>
          <p className="text-xs text-ink-muted">
            {crops.length} crops from {imageCount} image{imageCount !== 1 ? "s" : ""}
            {filterType && ` • Showing ${filteredCrops.length} ${filterType}`}
          </p>
        </div>

        {/* Filter dropdown */}
        <select
          value={filterType || ""}
          onChange={(e) => setFilterType(e.target.value || null)}
          className="text-xs bg-studio-surface border border-studio-border rounded px-2 py-1 text-ink-primary"
        >
          <option value="">All types</option>
          {elementTypes.map((type) => (
            <option key={type} value={type}>
              {type} ({crops.filter((c) => c.elementType === type).length})
            </option>
          ))}
        </select>
      </div>

      {/* Type chips */}
      <div className="flex flex-wrap gap-1">
        {elementTypes.map((type) => {
          const count = crops.filter((c) => c.elementType === type).length;
          const isActive = filterType === type;
          const color = typeColors[type] || typeColors.unknown;

          return (
            <button
              key={type}
              onClick={() => setFilterType(isActive ? null : type)}
              className={`
                inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs transition-all
                ${isActive ? "ring-1 ring-offset-1 ring-offset-studio-bg" : "opacity-70 hover:opacity-100"}
              `}
              style={{
                backgroundColor: `${color}15`,
                color: color,
                // @ts-expect-error CSS custom property for ring color
                "--tw-ring-color": isActive ? color : "transparent",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              {type}
              <span className="font-mono opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Crop grid */}
      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
        {filteredCrops.map((crop) => {
          const color = typeColors[crop.elementType] || typeColors.unknown;
          const isSelected = crop.id === selectedId;

          return (
            <button
              key={crop.id}
              onClick={() => handleCropClick(crop)}
              className={`
                relative group rounded-lg overflow-hidden border-2 transition-all
                aspect-square bg-studio-bg
                ${isSelected
                  ? "border-accent ring-2 ring-accent/20"
                  : "border-transparent hover:border-studio-border-accent"
                }
              `}
            >
              {/* Thumbnail */}
              <img
                src={crop.thumbnailDataUrl}
                alt={crop.label || crop.elementType}
                className="w-full h-full object-contain"
              />

              {/* Type badge */}
              <div
                className="absolute bottom-0 left-0 right-0 px-1 py-0.5 text-2xs font-medium text-white truncate"
                style={{ backgroundColor: `${color}cc` }}
              >
                {crop.elementType}
              </div>

              {/* Dimensions tooltip on hover */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50">
                <span className="text-2xs text-white font-mono">
                  {crop.dimensions.width}×{crop.dimensions.height}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected crop details */}
      {selectedId && (
        <div className="bg-studio-surface rounded-lg p-3">
          {(() => {
            const crop = crops.find((c) => c.id === selectedId);
            if (!crop) return null;
            const color = typeColors[crop.elementType] || typeColors.unknown;

            return (
              <div className="flex items-start gap-4">
                <img
                  src={crop.thumbnailDataUrl}
                  alt={crop.label || crop.elementType}
                  className="w-24 h-24 object-contain bg-studio-bg rounded"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: color }}
                    />
                    <span className="font-medium text-sm text-ink-primary">
                      {crop.elementType}
                    </span>
                  </div>
                  {crop.label && (
                    <p className="text-xs text-ink-secondary mt-1 truncate">
                      {crop.label}
                    </p>
                  )}
                  <p className="text-2xs text-ink-muted mt-2 font-mono">
                    {crop.dimensions.width}×{crop.dimensions.height}px
                  </p>
                  <p className="text-2xs text-ink-disabled mt-1 truncate">
                    ID: {crop.cropSpecId}
                  </p>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
