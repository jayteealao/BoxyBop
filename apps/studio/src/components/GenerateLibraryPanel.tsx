/**
 * Generate Library Panel.
 *
 * Provides the "Generate Library" flow that:
 * 1. Runs style analysis (Gemini + Claude) to lock tokens
 * 2. Runs full pipeline (OmniParser + crop analysis)
 * 3. Runs codegen to produce shadcn registry + Storybook
 *
 * Shows progress states, logs, and result links.
 */

import { useState, useCallback } from "react";
import type {
  StudioImage,
  CropSpec,
  GenerationProgress,
  GenerationStep,
  RunSetResponse,
  CodegenResponse,
} from "../types/studio";

interface GenerateLibraryPanelProps {
  images: StudioImage[];
  crops: Map<string, CropSpec[]>;
  disabled?: boolean;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function GenerateLibraryPanel({
  images,
  crops,
  disabled = false,
}: GenerateLibraryPanelProps) {
  const [progress, setProgress] = useState<GenerationProgress>({
    step: "idle",
    logs: [],
  });
  const [setSlug, setSetSlug] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const addLog = useCallback((message: string) => {
    setProgress((prev) => ({
      ...prev,
      logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] ${message}`],
    }));
  }, []);

  const setStep = useCallback((step: GenerationStep) => {
    setProgress((prev) => ({ ...prev, step }));
  }, []);

  const setError = useCallback((error: string) => {
    setProgress((prev) => ({ ...prev, step: "error", error }));
  }, []);

  const handleGenerate = useCallback(async () => {
    if (images.length === 0 || !setSlug.trim()) return;

    setIsGenerating(true);
    setProgress({ step: "idle", logs: [] });

    const setId = `set-${generateId()}`;
    const slug = setSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");

    try {
      // Step 1: Run full pipeline (includes style analysis)
      setStep("pipeline");
      addLog(`Starting pipeline for ${images.length} images...`);

      // Collect all manual crops
      const manualCrops: Array<{
        id: string;
        imageId: string;
        sourceElementId?: string;
        region: { x: number; y: number; width: number; height: number };
        label?: string;
      }> = [];

      for (const [imageId, imageCrops] of crops) {
        for (const crop of imageCrops) {
          manualCrops.push({
            id: crop.id,
            imageId,
            sourceElementId: crop.sourceElementId,
            region: {
              x: Math.round(crop.region.x),
              y: Math.round(crop.region.y),
              width: Math.round(crop.region.width),
              height: Math.round(crop.region.height),
            },
            label: crop.label,
          });
        }
      }

      addLog(`Prepared ${manualCrops.length} manual crops`);

      const pipelineResponse = await fetch("/api/run-set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setId,
          images: images.map((img) => ({
            id: img.id,
            base64: img.base64,
            mimeType: img.mimeType,
            width: img.naturalWidth,
            height: img.naturalHeight,
          })),
          manualCrops: manualCrops.length > 0 ? manualCrops : undefined,
        }),
      });

      if (!pipelineResponse.ok) {
        const errBody = await pipelineResponse.json().catch(() => ({}));
        throw new Error(errBody.message || `Pipeline failed: ${pipelineResponse.status}`);
      }

      const pipelineResult: RunSetResponse = await pipelineResponse.json();

      setProgress((prev) => ({
        ...prev,
        pipelineResult,
        styleResult: {
          styleRunId: pipelineResult.styleRunId,
          tokensHash: pipelineResult.summary.tokensHash,
          latencyMs: pipelineResult.latency.styleMs,
        },
      }));

      addLog(`Pipeline complete: ${pipelineResult.summary.elementsDetected} elements, ${pipelineResult.summary.cropsAnalyzed} crops`);
      addLog(`Style tokens locked (hash: ${pipelineResult.summary.tokensHash.slice(0, 12)}...)`);

      // Step 2: Run codegen
      setStep("codegen");
      addLog("Starting component generation...");

      const codegenResponse = await fetch("/api/codegen/v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: pipelineResult.runId,
          setSlug: slug,
        }),
      });

      if (!codegenResponse.ok) {
        const errBody = await codegenResponse.json().catch(() => ({}));
        throw new Error(errBody.message || `Codegen failed: ${codegenResponse.status}`);
      }

      const codegenResult: CodegenResponse = await codegenResponse.json();

      setProgress((prev) => ({
        ...prev,
        codegenResult,
      }));

      addLog(`Codegen complete: ${codegenResult.progress.complete}/${codegenResult.progress.total} components`);

      if (codegenResult.errors.length > 0) {
        addLog(`Warnings: ${codegenResult.errors.length} components failed`);
      }

      // Done!
      setStep("complete");
      addLog(`Library generated at ${codegenResult.packagePath}`);
      addLog("Ready for Storybook!");

    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      addLog(`Error: ${message}`);
    } finally {
      setIsGenerating(false);
    }
  }, [images, crops, setSlug, addLog, setStep, setError]);

  const stepLabels: Record<GenerationStep, string> = {
    idle: "Ready",
    style: "Analyzing Style...",
    pipeline: "Running Pipeline...",
    codegen: "Generating Components...",
    complete: "Complete!",
    error: "Failed",
  };

  const canGenerate = images.length > 0 && setSlug.trim() && !isGenerating && !disabled;

  return (
    <div
      style={{
        backgroundColor: "#1a1a1a",
        padding: "1rem",
        borderRadius: "8px",
        marginTop: "1.5rem",
      }}
    >
      <h3 style={{ margin: "0 0 0.75rem", color: "#4ade80" }}>
        Generate Library
      </h3>

      {/* Set slug input */}
      <div style={{ marginBottom: "1rem" }}>
        <label
          style={{ display: "block", fontSize: "0.875rem", marginBottom: "0.25rem" }}
        >
          Package name:
        </label>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span style={{ color: "#888" }}>ui-</span>
          <input
            type="text"
            value={setSlug}
            onChange={(e) => setSetSlug(e.target.value)}
            placeholder="my-app"
            disabled={isGenerating}
            style={{
              flex: 1,
              padding: "0.5rem",
              backgroundColor: "#000",
              border: "1px solid #333",
              borderRadius: "4px",
              color: "#fff",
              fontFamily: "monospace",
            }}
          />
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={!canGenerate}
        style={{
          width: "100%",
          padding: "0.75rem",
          backgroundColor: canGenerate ? "#4ade80" : "#333",
          color: canGenerate ? "#000" : "#666",
          border: "none",
          borderRadius: "4px",
          fontSize: "1rem",
          fontWeight: 600,
          cursor: canGenerate ? "pointer" : "not-allowed",
        }}
      >
        {isGenerating ? stepLabels[progress.step] : "Generate Library"}
      </button>

      {/* Progress indicator */}
      {progress.step !== "idle" && (
        <div style={{ marginTop: "1rem" }}>
          {/* Step indicators */}
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
            {(["pipeline", "codegen", "complete"] as GenerationStep[]).map((step) => {
              const isActive = progress.step === step;
              const isPast =
                (step === "pipeline" && ["codegen", "complete"].includes(progress.step)) ||
                (step === "codegen" && progress.step === "complete");
              const isError = progress.step === "error";

              return (
                <div
                  key={step}
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: isError
                      ? "#f87171"
                      : isPast || (isActive && step === "complete")
                      ? "#4ade80"
                      : isActive
                      ? "#8b5cf6"
                      : "#333",
                    transition: "background-color 0.2s",
                  }}
                />
              );
            })}
          </div>

          {/* Logs */}
          <div
            style={{
              maxHeight: 150,
              overflowY: "auto",
              backgroundColor: "#000",
              padding: "0.5rem",
              borderRadius: "4px",
              fontSize: "0.75rem",
              fontFamily: "monospace",
            }}
          >
            {progress.logs.map((log, idx) => (
              <div
                key={idx}
                style={{
                  color: log.includes("Error") ? "#f87171" : "#888",
                  marginBottom: "0.25rem",
                }}
              >
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {progress.step === "complete" && progress.codegenResult && (
        <div
          style={{
            marginTop: "1rem",
            padding: "0.75rem",
            backgroundColor: "#000",
            borderRadius: "4px",
          }}
        >
          <h4 style={{ margin: "0 0 0.5rem", color: "#4ade80" }}>
            Library Ready
          </h4>

          <div style={{ fontSize: "0.875rem", marginBottom: "0.75rem" }}>
            <p style={{ margin: "0 0 0.25rem" }}>
              <strong>Package:</strong>{" "}
              <code style={{ color: "#8b5cf6" }}>
                @boxybop/ui-{setSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-")}
              </code>
            </p>
            <p style={{ margin: "0 0 0.25rem" }}>
              <strong>Components:</strong> {progress.codegenResult.progress.complete}
            </p>
            <p style={{ margin: "0" }}>
              <strong>Path:</strong>{" "}
              <code style={{ fontSize: "0.75rem", color: "#888" }}>
                {progress.codegenResult.packagePath}
              </code>
            </p>
          </div>

          {/* Action links */}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              onClick={() => {
                // Open Storybook in new tab (assuming it's running on :6006)
                window.open(`http://localhost:6006`, "_blank");
              }}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "#8b5cf6",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              Open Storybook
            </button>

            <button
              onClick={() => {
                // Show component inventory (could open a modal or navigate)
                const components = progress.codegenResult?.progress.complete || 0;
                alert(`Component Inventory:\n\n${components} components generated.\n\nCheck the package at:\n${progress.codegenResult?.packagePath}`);
              }}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "#3b82f6",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              View Inventory
            </button>

            <button
              onClick={async () => {
                // Download package as zip
                // Note: This would require a backend endpoint to zip the package
                // For now, show the path
                const packagePath = progress.codegenResult?.packagePath;
                if (packagePath) {
                  try {
                    const response = await fetch(`/api/download-package?path=${encodeURIComponent(packagePath)}`);
                    if (response.ok) {
                      const blob = await response.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `ui-${setSlug}.zip`;
                      a.click();
                      URL.revokeObjectURL(url);
                    } else {
                      // Fallback: copy path to clipboard
                      await navigator.clipboard.writeText(packagePath);
                      alert(`Package path copied to clipboard:\n${packagePath}`);
                    }
                  } catch {
                    await navigator.clipboard.writeText(packagePath);
                    alert(`Package path copied to clipboard:\n${packagePath}`);
                  }
                }
              }}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "#333",
                color: "#fff",
                border: "1px solid #666",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              Download ZIP
            </button>
          </div>

          {/* Component stats */}
          {progress.pipelineResult && (
            <div
              style={{
                marginTop: "0.75rem",
                paddingTop: "0.75rem",
                borderTop: "1px solid #333",
                fontSize: "0.75rem",
                color: "#888",
              }}
            >
              <p style={{ margin: "0 0 0.25rem" }}>
                Detected {progress.pipelineResult.summary.elementsDetected} elements
              </p>
              <p style={{ margin: "0 0 0.25rem" }}>
                Analyzed {progress.pipelineResult.summary.cropsAnalyzed} components
              </p>
              <p style={{ margin: "0" }}>
                Total time: {(progress.pipelineResult.latency.totalMs / 1000).toFixed(1)}s +{" "}
                {((progress.codegenResult?.latencyMs || 0) / 1000).toFixed(1)}s codegen
              </p>
            </div>
          )}
        </div>
      )}

      {/* Error state */}
      {progress.step === "error" && progress.error && (
        <div
          style={{
            marginTop: "1rem",
            padding: "0.75rem",
            backgroundColor: "#7f1d1d",
            borderRadius: "4px",
            color: "#fecaca",
          }}
        >
          <strong>Generation failed:</strong>
          <p style={{ margin: "0.5rem 0 0" }}>{progress.error}</p>
          <button
            onClick={() => setProgress({ step: "idle", logs: [] })}
            style={{
              marginTop: "0.75rem",
              padding: "0.5rem 1rem",
              backgroundColor: "#dc2626",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
