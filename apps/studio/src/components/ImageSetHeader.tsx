/**
 * Image Set Header - Persistent summary bar for image sets.
 */

import { useMemo } from "react";
import type { StudioImage } from "../types/studio";

interface ImageSetHeaderProps {
  images: StudioImage[];
  createdAt?: Date;
  styleRunId?: string;
  runId?: string;
  onRunStylePass?: () => void;
  onRunPipeline?: () => void;
  onGenerateLibrary?: () => void;
  isLoading?: boolean;
  replicateConfigured?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function estimateBase64Size(base64: string): number {
  return Math.floor((base64.length * 3) / 4);
}

export function ImageSetHeader({
  images,
  createdAt,
  styleRunId,
  runId,
  onRunStylePass,
  onRunPipeline,
  onGenerateLibrary,
  isLoading,
  replicateConfigured = true,
}: ImageSetHeaderProps) {
  const totalSize = useMemo(() => {
    return images.reduce((acc, img) => acc + estimateBase64Size(img.base64), 0);
  }, [images]);

  const formattedDate = useMemo(() => {
    const date = createdAt || new Date();
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }, [createdAt]);

  if (images.length === 0) {
    return null;
  }

  return (
    <div className="bg-studio-surface border border-studio-border rounded-xl p-4">
      {/* Title and metadata */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-accent"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <h2 className="text-lg font-semibold text-ink-primary">
              Screenshot Set
            </h2>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {images.length} image{images.length !== 1 ? "s" : ""}
            <span className="mx-2 text-ink-disabled">•</span>
            {formatBytes(totalSize)} total
            <span className="mx-2 text-ink-disabled">•</span>
            {formattedDate}
          </p>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-2">
          {styleRunId && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-success/10 text-success text-xs rounded-full">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Style Pass
            </span>
          )}
          {runId && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-success/10 text-success text-xs rounded-full">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Pipeline Complete
            </span>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-studio-border">
        {onRunStylePass && (
          <button
            onClick={onRunStylePass}
            disabled={isLoading || !!styleRunId}
            className={`
              btn-secondary text-sm
              ${styleRunId ? "opacity-50 cursor-not-allowed" : ""}
            `}
          >
            {styleRunId ? "Style Pass Complete" : "Run Style Pass"}
          </button>
        )}

        {onRunPipeline && (
          <button
            onClick={onRunPipeline}
            disabled={isLoading || !replicateConfigured}
            className="btn-primary text-sm"
          >
            {isLoading ? "Running..." : "Run Full Pipeline"}
          </button>
        )}

        {onGenerateLibrary && (
          <button
            onClick={onGenerateLibrary}
            disabled={isLoading || !runId}
            className={`
              btn-accent text-sm
              ${!runId ? "opacity-50 cursor-not-allowed" : ""}
            `}
          >
            Generate Library
          </button>
        )}

        {!replicateConfigured && (
          <span className="text-xs text-warning">
            OmniParser not configured
          </span>
        )}
      </div>
    </div>
  );
}
