import { useCallback, useRef } from "react";
import type { StudioImage } from "../types/studio";

interface ImageUploaderProps {
  onImagesAdded: (images: StudioImage[]) => void;
  disabled?: boolean;
}

function generateId(): string {
  return `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function fileToStudioImage(file: File): Promise<StudioImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Extract base64 from data URL
      const base64 = dataUrl.split(",")[1];

      // Get natural dimensions
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

export function ImageUploader({ onImagesAdded, disabled }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const validFiles = Array.from(files).filter((f) =>
        ["image/png", "image/jpeg", "image/webp"].includes(f.type)
      );

      if (validFiles.length === 0) return;

      try {
        const images = await Promise.all(validFiles.map(fileToStudioImage));
        onImagesAdded(images);
      } catch (err) {
        console.error("Failed to process images:", err);
      }
    },
    [onImagesAdded]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={() => inputRef.current?.click()}
      style={{
        border: "2px dashed #666",
        borderRadius: "8px",
        padding: "2rem",
        textAlign: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        backgroundColor: "#1a1a1a",
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        onChange={(e) => handleFiles(e.target.files)}
        style={{ display: "none" }}
        disabled={disabled}
      />
      <p style={{ margin: 0, color: "#888" }}>
        Drop images here or click to select
      </p>
      <p style={{ margin: "0.5rem 0 0", fontSize: "0.875rem", color: "#666" }}>
        PNG, JPEG, or WebP
      </p>
    </div>
  );
}
