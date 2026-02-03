/**
 * Image Thumbnail Grid - Shows uploaded images with metadata and status.
 */

import { useMemo } from "react";
import type { StudioImage, DetectedElement } from "../types/studio";

type ParseStatus = "pending" | "parsing" | "parsed" | "complete" | "failed";

interface ImageThumbnailGridProps {
  images: StudioImage[];
  elementsMap: Map<string, DetectedElement[]>;
  currentIndex: number;
  onSelectImage: (index: number) => void;
  parseStatus?: Map<string, ParseStatus>;
  errors?: Map<string, string>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function estimateBase64Size(base64: string): number {
  // Base64 inflates size by ~33%, reverse to estimate original
  return Math.floor((base64.length * 3) / 4);
}

export function ImageThumbnailGrid({
  images,
  elementsMap,
  currentIndex,
  onSelectImage,
  parseStatus,
  errors,
}: ImageThumbnailGridProps) {
  const totalSize = useMemo(() => {
    return images.reduce((acc, img) => acc + estimateBase64Size(img.base64), 0);
  }, [images]);

  if (images.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Summary header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-ink-primary">
          {images.length} image{images.length !== 1 ? "s" : ""} uploaded
        </h3>
        <span className="text-xs text-ink-muted">
          {formatBytes(totalSize)} total
        </span>
      </div>

      {/* Thumbnail grid */}
      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
        {images.map((img, idx) => {
          const elements = elementsMap.get(img.id);
          const status = parseStatus?.get(img.id) ?? (elements ? "parsed" : "pending");
          const error = errors?.get(img.id);
          const isSelected = idx === currentIndex;
          const sizeBytes = estimateBase64Size(img.base64);

          return (
            <button
              key={img.id}
              onClick={() => onSelectImage(idx)}
              className={`
                relative group rounded-lg overflow-hidden border-2 transition-all
                aspect-square
                ${isSelected
                  ? "border-accent shadow-glow-sm ring-2 ring-accent/20"
                  : "border-transparent hover:border-studio-border-accent"
                }
                ${error ? "border-danger/50" : ""}
              `}
              title={`${img.filename}\n${img.naturalWidth}×${img.naturalHeight}\n${formatBytes(sizeBytes)}`}
            >
              {/* Thumbnail */}
              <img
                src={img.dataUrl}
                alt={img.filename}
                className="w-full h-full object-cover"
              />

              {/* Status overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              {/* Status badge */}
              <div className="absolute bottom-0 left-0 right-0 p-1">
                {status === "parsing" && (
                  <div className="flex items-center gap-1 text-2xs text-accent">
                    <span className="animate-pulse">Parsing...</span>
                  </div>
                )}
                {(status === "parsed" || status === "complete") && elements && (
                  <div className="text-2xs text-success font-medium">
                    {elements.length} boxes
                  </div>
                )}
                {status === "failed" && (
                  <div className="text-2xs text-danger font-medium">
                    Failed
                  </div>
                )}
              </div>

              {/* Index badge */}
              <div className="absolute top-1 left-1 bg-black/70 text-white text-2xs px-1 rounded">
                {idx + 1}
              </div>

              {/* Hover metadata */}
              <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50">
                <span className="text-2xs text-white font-mono">
                  {img.naturalWidth}×{img.naturalHeight}
                </span>
                <span className="text-2xs text-white/70">
                  {formatBytes(sizeBytes)}
                </span>
              </div>

              {/* Error tooltip */}
              {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-danger/20">
                  <span className="text-2xs text-danger text-center px-1">
                    {error}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
