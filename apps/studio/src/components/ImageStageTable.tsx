/**
 * Image Stage Table - Per-image breakdown of pipeline stages.
 */

import type { StudioImage, DetectedElement } from "../types/studio";

export interface ImageStageStatus {
  imageId: string;
  parseStatus: "pending" | "parsing" | "complete" | "failed";
  parseLatencyMs?: number;
  boxCount?: number;
  cropCount?: number;
  analysisStatus: "pending" | "analyzing" | "complete" | "failed";
  analysisLatencyMs?: number;
  error?: string;
}

interface ImageStageTableProps {
  images: StudioImage[];
  stageStatuses: Map<string, ImageStageStatus>;
  elementsMap: Map<string, DetectedElement[]>;
  onViewOverlay?: (imageId: string) => void;
  onViewCrops?: (imageId: string) => void;
  onRetry?: (imageId: string) => void;
}

const statusBadge = {
  pending: "bg-studio-border text-ink-muted",
  parsing: "bg-accent/20 text-accent",
  analyzing: "bg-accent/20 text-accent",
  complete: "bg-success/20 text-success",
  failed: "bg-danger/20 text-danger",
};

function formatDuration(ms?: number): string {
  if (!ms) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function ImageStageTable({
  images,
  stageStatuses,
  elementsMap,
  onViewOverlay,
  onViewCrops,
  onRetry,
}: ImageStageTableProps) {
  if (images.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-studio-border">
            <th className="text-left py-2 px-3 text-ink-muted font-medium">#</th>
            <th className="text-left py-2 px-3 text-ink-muted font-medium">Image</th>
            <th className="text-center py-2 px-3 text-ink-muted font-medium">Parse</th>
            <th className="text-center py-2 px-3 text-ink-muted font-medium">Boxes</th>
            <th className="text-center py-2 px-3 text-ink-muted font-medium">Crops</th>
            <th className="text-center py-2 px-3 text-ink-muted font-medium">Analysis</th>
            <th className="text-center py-2 px-3 text-ink-muted font-medium">Status</th>
            <th className="text-right py-2 px-3 text-ink-muted font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {images.map((image, idx) => {
            const status = stageStatuses.get(image.id);
            const elements = elementsMap.get(image.id);
            const parseStatus = status?.parseStatus ?? (elements ? "complete" : "pending");
            const analysisStatus = status?.analysisStatus ?? "pending";
            const boxCount = status?.boxCount ?? elements?.length ?? 0;
            const cropCount = status?.cropCount ?? 0;
            const hasFailed = parseStatus === "failed" || analysisStatus === "failed";
            const isComplete = parseStatus === "complete" && analysisStatus === "complete";

            return (
              <tr
                key={image.id}
                className={`
                  border-b border-studio-border/50 transition-colors
                  ${hasFailed ? "bg-danger/5" : "hover:bg-studio-surface/50"}
                `}
              >
                {/* Index */}
                <td className="py-2 px-3 text-ink-muted font-mono text-xs">
                  {idx + 1}
                </td>

                {/* Image thumbnail + name */}
                <td className="py-2 px-3">
                  <div className="flex items-center gap-2">
                    <img
                      src={image.dataUrl}
                      alt={image.filename}
                      className="w-8 h-8 rounded object-cover bg-studio-bg"
                    />
                    <div className="overflow-hidden">
                      <p className="text-ink-primary text-xs truncate max-w-[120px]">
                        {image.filename}
                      </p>
                      <p className="text-2xs text-ink-muted">
                        {image.naturalWidth}×{image.naturalHeight}
                      </p>
                    </div>
                  </div>
                </td>

                {/* Parse status */}
                <td className="py-2 px-3 text-center">
                  <span className={`
                    inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium
                    ${statusBadge[parseStatus]}
                  `}>
                    {parseStatus === "parsing" && (
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                    )}
                    {parseStatus === "complete" ? formatDuration(status?.parseLatencyMs) : parseStatus}
                  </span>
                </td>

                {/* Box count */}
                <td className="py-2 px-3 text-center">
                  <span className={`
                    font-mono text-xs
                    ${boxCount > 0 ? "text-ink-primary" : "text-ink-muted"}
                  `}>
                    {parseStatus === "complete" ? boxCount : "-"}
                  </span>
                </td>

                {/* Crop count */}
                <td className="py-2 px-3 text-center">
                  <span className={`
                    font-mono text-xs
                    ${cropCount > 0 ? "text-ink-primary" : "text-ink-muted"}
                  `}>
                    {cropCount > 0 ? cropCount : "-"}
                  </span>
                </td>

                {/* Analysis status */}
                <td className="py-2 px-3 text-center">
                  <span className={`
                    inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium
                    ${statusBadge[analysisStatus]}
                  `}>
                    {analysisStatus === "analyzing" && (
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                    )}
                    {analysisStatus === "complete" ? formatDuration(status?.analysisLatencyMs) : analysisStatus}
                  </span>
                </td>

                {/* Overall status */}
                <td className="py-2 px-3 text-center">
                  {hasFailed ? (
                    <span className="text-2xs text-danger">
                      {status?.error || "Failed"}
                    </span>
                  ) : isComplete ? (
                    <svg className="w-4 h-4 text-success mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <span className="text-2xs text-ink-muted">In progress</span>
                  )}
                </td>

                {/* Actions */}
                <td className="py-2 px-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {onViewOverlay && parseStatus === "complete" && (
                      <button
                        onClick={() => onViewOverlay(image.id)}
                        className="p-1 text-ink-muted hover:text-accent transition-colors"
                        title="View overlay"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <path d="M3 9h18M9 21V9" />
                        </svg>
                      </button>
                    )}
                    {onViewCrops && cropCount > 0 && (
                      <button
                        onClick={() => onViewCrops(image.id)}
                        className="p-1 text-ink-muted hover:text-accent transition-colors"
                        title="View crops"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="7" height="7" rx="1" />
                          <rect x="14" y="3" width="7" height="7" rx="1" />
                          <rect x="3" y="14" width="7" height="7" rx="1" />
                          <rect x="14" y="14" width="7" height="7" rx="1" />
                        </svg>
                      </button>
                    )}
                    {onRetry && hasFailed && (
                      <button
                        onClick={() => onRetry(image.id)}
                        className="p-1 text-danger hover:text-danger/80 transition-colors"
                        title="Retry"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 4v6h6M23 20v-6h-6" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
