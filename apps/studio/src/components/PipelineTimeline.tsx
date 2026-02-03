/**
 * Pipeline Timeline - Visual stage-by-stage pipeline progress display.
 */

import { useMemo } from "react";

export type StageStatus = "pending" | "running" | "complete" | "failed" | "skipped";

export interface PipelineStage {
  id: string;
  label: string;
  status: StageStatus;
  startedAt?: string;
  completedAt?: string;
  latencyMs?: number;
  progress?: { current: number; total: number };
  error?: string;
}

export interface PipelineLog {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
  stage?: string;
}

interface PipelineTimelineProps {
  stages: PipelineStage[];
  logs: PipelineLog[];
  currentStage?: string;
  overallProgress?: { current: number; total: number };
  elapsedMs?: number;
  error?: string;
  onRetryStage?: (stageId: string) => void;
}

const statusIcons: Record<StageStatus, JSX.Element> = {
  pending: (
    <svg className="w-4 h-4 text-ink-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
    </svg>
  ),
  running: (
    <svg className="w-4 h-4 text-accent animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" opacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
    </svg>
  ),
  complete: (
    <svg className="w-4 h-4 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.1" />
      <path d="M8 12l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  failed: (
    <svg className="w-4 h-4 text-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.1" />
      <path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round" />
    </svg>
  ),
  skipped: (
    <svg className="w-4 h-4 text-ink-disabled" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12h8" strokeLinecap="round" />
    </svg>
  ),
};

const statusColors: Record<StageStatus, string> = {
  pending: "bg-studio-border",
  running: "bg-accent",
  complete: "bg-success",
  failed: "bg-danger",
  skipped: "bg-ink-disabled",
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

export function PipelineTimeline({
  stages,
  logs,
  currentStage,
  overallProgress,
  elapsedMs,
  error,
  onRetryStage,
}: PipelineTimelineProps) {
  const progressPercent = useMemo(() => {
    if (!overallProgress || overallProgress.total === 0) return 0;
    return Math.round((overallProgress.current / overallProgress.total) * 100);
  }, [overallProgress]);

  const currentStageObj = stages.find((s) => s.id === currentStage);

  return (
    <div className="space-y-4">
      {/* Stage timeline */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {stages.map((stage, idx) => (
          <div key={stage.id} className="flex items-center">
            {/* Stage node */}
            <div
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg transition-all
                ${stage.status === "running" ? "bg-accent/10 ring-1 ring-accent/30" : "bg-studio-surface"}
                ${stage.status === "failed" ? "bg-danger/10 ring-1 ring-danger/30" : ""}
              `}
            >
              {statusIcons[stage.status]}
              <div className="flex flex-col">
                <span className={`
                  text-xs font-medium whitespace-nowrap
                  ${stage.status === "running" ? "text-accent" : ""}
                  ${stage.status === "complete" ? "text-success" : ""}
                  ${stage.status === "failed" ? "text-danger" : ""}
                  ${stage.status === "pending" ? "text-ink-muted" : ""}
                `}>
                  {stage.label}
                </span>
                {stage.latencyMs && stage.status === "complete" && (
                  <span className="text-2xs text-ink-muted">
                    {formatDuration(stage.latencyMs)}
                  </span>
                )}
                {stage.progress && stage.status === "running" && (
                  <span className="text-2xs text-accent">
                    {stage.progress.current}/{stage.progress.total}
                  </span>
                )}
              </div>
            </div>

            {/* Connector line */}
            {idx < stages.length - 1 && (
              <div className={`
                w-6 h-0.5 mx-1
                ${stages[idx + 1].status !== "pending" ? statusColors[stage.status] : "bg-studio-border"}
              `} />
            )}
          </div>
        ))}
      </div>

      {/* Current stage progress */}
      {currentStageObj && currentStageObj.status === "running" && (
        <div className="bg-studio-surface rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-ink-primary">
              {currentStageObj.label}
            </span>
            {elapsedMs && (
              <span className="text-xs text-ink-muted">
                Elapsed: {formatDuration(elapsedMs)}
              </span>
            )}
          </div>

          {/* Progress bar */}
          {overallProgress && overallProgress.total > 0 && (
            <div className="space-y-1">
              <div className="h-2 bg-studio-bg rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-2xs text-ink-muted">
                <span>{progressPercent}%</span>
                <span>{overallProgress.current}/{overallProgress.total}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-danger/10 border border-danger/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-danger">Pipeline failed</p>
              <p className="text-xs text-danger/80 mt-1">{error}</p>
              {onRetryStage && currentStage && (
                <button
                  onClick={() => onRetryStage(currentStage)}
                  className="btn-danger text-xs mt-3"
                >
                  Retry {currentStageObj?.label || "Stage"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Logs */}
      {logs.length > 0 && (
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer text-sm text-ink-muted hover:text-ink-primary transition-colors">
            <svg className="w-4 h-4 transition-transform group-open:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Logs ({logs.length})
          </summary>
          <div className="mt-2 max-h-48 overflow-y-auto bg-studio-bg rounded-lg p-3 font-mono text-xs">
            {logs.map((log, idx) => (
              <div
                key={idx}
                className={`
                  py-0.5
                  ${log.level === "error" ? "text-danger" : ""}
                  ${log.level === "warn" ? "text-warning" : ""}
                  ${log.level === "info" ? "text-ink-muted" : ""}
                `}
              >
                <span className="text-ink-disabled">[{log.timestamp}]</span>
                {log.stage && <span className="text-accent ml-1">[{log.stage}]</span>}
                <span className="ml-1">{log.message}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

/**
 * Create default pipeline stages for the full pipeline flow.
 */
export function createDefaultStages(): PipelineStage[] {
  return [
    { id: "queue", label: "Queued", status: "pending" },
    { id: "style", label: "Style Pass", status: "pending" },
    { id: "parse", label: "OmniParser", status: "pending" },
    { id: "crop", label: "Crop Extract", status: "pending" },
    { id: "analysis", label: "Crop Analysis", status: "pending" },
    { id: "ir", label: "IR Build", status: "pending" },
    { id: "codegen", label: "Codegen", status: "pending" },
  ];
}

/**
 * Update stage status in the stages array.
 */
export function updateStageStatus(
  stages: PipelineStage[],
  stageId: string,
  updates: Partial<PipelineStage>
): PipelineStage[] {
  return stages.map((stage) =>
    stage.id === stageId ? { ...stage, ...updates } : stage
  );
}
