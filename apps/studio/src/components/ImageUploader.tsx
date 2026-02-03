/**
 * Image Uploader - Drag/drop upload with validation and feedback.
 */

import { useCallback, useRef, useState } from "react";
import type { StudioImage } from "../types/studio";

interface ImageUploaderProps {
  onImagesAdded: (images: StudioImage[]) => void;
  disabled?: boolean;
  compact?: boolean;
}

interface ValidationError {
  filename: string;
  reason: string;
}

const SUPPORTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function generateId(): string {
  return `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function fileToStudioImage(file: File): Promise<StudioImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];

      const img = new Image();
      img.onload = () => {
        resolve({
          id: generateId(),
          filename: file.name,
          mimeType: file.type as StudioImage["mimeType"],
          base64,
          dataUrl,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
        });
      };
      img.onerror = () => reject(new Error(`Failed to load image: ${file.name}`));
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export function ImageUploader({ onImagesAdded, disabled, compact }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const validateFile = useCallback((file: File): ValidationError | null => {
    if (!SUPPORTED_TYPES.includes(file.type)) {
      return {
        filename: file.name,
        reason: `Unsupported type: ${file.type || "unknown"}. Use PNG, JPEG, or WebP.`,
      };
    }
    if (file.size > MAX_FILE_SIZE) {
      return {
        filename: file.name,
        reason: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max 10MB.`,
      };
    }
    return null;
  }, []);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      setIsProcessing(true);
      setErrors([]);

      const validationErrors: ValidationError[] = [];
      const validFiles: File[] = [];

      for (const file of Array.from(files)) {
        const error = validateFile(file);
        if (error) {
          validationErrors.push(error);
        } else {
          validFiles.push(file);
        }
      }

      if (validationErrors.length > 0) {
        setErrors(validationErrors);
      }

      if (validFiles.length > 0) {
        try {
          const images = await Promise.all(validFiles.map(fileToStudioImage));
          onImagesAdded(images);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to process images";
          setErrors((prev) => [...prev, { filename: "Processing", reason: message }]);
        }
      }

      setIsProcessing(false);
    },
    [onImagesAdded, validateFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const dismissErrors = useCallback(() => {
    setErrors([]);
  }, []);

  return (
    <div className="space-y-3">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`
          relative rounded-lg border-2 border-dashed transition-all cursor-pointer
          ${compact ? "p-4" : "p-8"}
          ${isDragging
            ? "border-accent bg-accent/5"
            : "border-studio-border hover:border-studio-border-accent"
          }
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
          ${isProcessing ? "animate-pulse" : ""}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={SUPPORTED_TYPES.join(",")}
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
          disabled={disabled || isProcessing}
        />

        <div className="flex flex-col items-center text-center">
          {/* Upload icon */}
          <div className={`
            rounded-full bg-studio-surface mb-3
            ${compact ? "w-10 h-10" : "w-14 h-14"}
            flex items-center justify-center
          `}>
            <svg
              className={`text-ink-muted ${compact ? "w-5 h-5" : "w-7 h-7"}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <p className={`text-ink-secondary ${compact ? "text-sm" : ""}`}>
            {isProcessing
              ? "Processing images..."
              : isDragging
              ? "Drop images here"
              : "Drop images here or click to select"
            }
          </p>

          <p className="text-xs text-ink-muted mt-1">
            PNG, JPEG, or WebP • Max 10MB each
          </p>
        </div>
      </div>

      {/* Validation errors */}
      {errors.length > 0 && (
        <div className="rounded-lg bg-danger/10 border border-danger/20 p-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 text-danger text-sm font-medium">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round" />
              </svg>
              {errors.length} file{errors.length !== 1 ? "s" : ""} rejected
            </div>
            <button
              onClick={dismissErrors}
              className="text-danger/70 hover:text-danger text-sm"
            >
              Dismiss
            </button>
          </div>
          <ul className="mt-2 space-y-1">
            {errors.map((error, idx) => (
              <li key={idx} className="text-xs text-danger/80">
                <span className="font-medium">{error.filename}:</span> {error.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
