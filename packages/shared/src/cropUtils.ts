/**
 * Server-side image cropping utilities.
 *
 * Uses sharp for efficient image manipulation without canvas/browser dependencies.
 */

import sharp from "sharp";
import { createHash } from "node:crypto";

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropResult {
  /** PNG as base64 string (without data: prefix) */
  pngBase64: string;
  /** SHA-256 hash of PNG bytes (hex) */
  sha256: string;
  /** Cropped dimensions */
  dimensions: { width: number; height: number };
  /** File size in bytes */
  sizeBytes: number;
}

/**
 * Crop a region from an image buffer.
 *
 * @param imageBuffer - Source image as Buffer (PNG, JPEG, etc.)
 * @param cropRegion - Region to crop in ORIGINAL pixel coordinates
 */
export async function cropImage(
  imageBuffer: Buffer,
  cropRegion: BBox
): Promise<CropResult> {
  // Extract the cropped region
  const croppedBuffer = await sharp(imageBuffer)
    .extract({
      left: Math.round(cropRegion.x),
      top: Math.round(cropRegion.y),
      width: Math.round(cropRegion.width),
      height: Math.round(cropRegion.height),
    })
    .png()
    .toBuffer();

  // Compute SHA-256
  const hash = createHash("sha256").update(croppedBuffer).digest("hex");

  return {
    pngBase64: croppedBuffer.toString("base64"),
    sha256: hash,
    dimensions: {
      width: Math.round(cropRegion.width),
      height: Math.round(cropRegion.height),
    },
    sizeBytes: croppedBuffer.length,
  };
}

/**
 * Crop from base64 image data.
 */
export async function cropImageFromBase64(
  base64: string,
  cropRegion: BBox
): Promise<CropResult> {
  // Remove data URL prefix if present
  const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(cleanBase64, "base64");
  return cropImage(buffer, cropRegion);
}

/**
 * Get image dimensions from buffer.
 */
export async function getImageDimensions(
  imageBuffer: Buffer
): Promise<{ width: number; height: number }> {
  const metadata = await sharp(imageBuffer).metadata();
  return {
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
  };
}

/**
 * Compute SHA-256 hash of a buffer.
 */
export function computeSha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Filter boxes that are too small (likely noise).
 */
export function filterTinyBoxes(
  boxes: BBox[],
  minWidth: number = 10,
  minHeight: number = 10
): BBox[] {
  return boxes.filter(
    (box) => box.width >= minWidth && box.height >= minHeight
  );
}

/**
 * Compute Intersection over Union (IoU) for two boxes.
 */
export function computeIoU(a: BBox, b: BBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);

  if (x2 <= x1 || y2 <= y1) {
    return 0; // No intersection
  }

  const intersection = (x2 - x1) * (y2 - y1);
  const areaA = a.width * a.height;
  const areaB = b.width * b.height;
  const union = areaA + areaB - intersection;

  return intersection / union;
}

/**
 * Deduplicate overlapping boxes using IoU threshold.
 * Keeps the larger box when overlap exceeds threshold.
 */
export function dedupeByIoU<T extends { bbox: BBox }>(
  elements: T[],
  iouThreshold: number = 0.5
): T[] {
  if (elements.length === 0) return [];

  // Sort by area (largest first)
  const sorted = [...elements].sort(
    (a, b) =>
      b.bbox.width * b.bbox.height - a.bbox.width * a.bbox.height
  );

  const kept: T[] = [];

  for (const element of sorted) {
    // Check if this element overlaps too much with any kept element
    const overlapsWithKept = kept.some(
      (kept) => computeIoU(element.bbox, kept.bbox) > iouThreshold
    );

    if (!overlapsWithKept) {
      kept.push(element);
    }
  }

  return kept;
}
