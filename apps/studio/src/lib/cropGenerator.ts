/**
 * Crop image using canvas and generate PNG bytes with sha256 hash.
 */

import type { BBox, Dimensions } from "./coordinates";

export interface CropResult {
  /** PNG as base64 string (without data: prefix) */
  pngBase64: string;
  /** Data URL for preview */
  dataUrl: string;
  /** SHA-256 hash of PNG bytes (hex) */
  sha256: string;
  /** Cropped dimensions */
  dimensions: Dimensions;
  /** File size in bytes */
  sizeBytes: number;
}

/**
 * Compute SHA-256 hash of ArrayBuffer.
 */
async function sha256(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Convert base64 string to ArrayBuffer.
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Crop a region from an image and return PNG bytes + sha256.
 * @param imageDataUrl - Source image as data URL
 * @param cropRegion - Region to crop in ORIGINAL pixel coordinates
 */
export async function generateCrop(
  imageDataUrl: string,
  cropRegion: BBox
): Promise<CropResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = async () => {
      try {
        // Create canvas with crop dimensions
        const canvas = document.createElement("canvas");
        canvas.width = cropRegion.width;
        canvas.height = cropRegion.height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("Failed to get canvas 2d context");
        }

        // Draw cropped region
        ctx.drawImage(
          img,
          cropRegion.x,
          cropRegion.y,
          cropRegion.width,
          cropRegion.height,
          0,
          0,
          cropRegion.width,
          cropRegion.height
        );

        // Get PNG data URL
        const dataUrl = canvas.toDataURL("image/png");

        // Extract base64 (remove "data:image/png;base64," prefix)
        const pngBase64 = dataUrl.split(",")[1];

        // Compute sha256
        const buffer = base64ToArrayBuffer(pngBase64);
        const hash = await sha256(buffer);

        resolve({
          pngBase64,
          dataUrl,
          sha256: hash,
          dimensions: {
            width: cropRegion.width,
            height: cropRegion.height,
          },
          sizeBytes: buffer.byteLength,
        });
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      reject(new Error("Failed to load image for cropping"));
    };

    img.src = imageDataUrl;
  });
}
