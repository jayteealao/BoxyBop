/**
 * Studio-specific types for UI state.
 * Uses original pixel coordinates for all geometry (per IR schema).
 */

/** Bounding box in original pixel coordinates */
export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A single uploaded image with its data */
export interface StudioImage {
  id: string;
  filename: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  /** Base64-encoded image data (without data: prefix) */
  base64: string;
  /** Data URL for display */
  dataUrl: string;
  /** Original/natural dimensions in pixels */
  naturalWidth: number;
  naturalHeight: number;
}

/** A detected UI element from OmniParser */
export interface DetectedElement {
  id: string;
  /** Bounding box in ORIGINAL pixel coordinates */
  bbox: BBox;
  type?: string;
  text?: string;
  confidence?: number;
  source: string;
}

/** Parse result from pipeline */
export interface ParseResult {
  image_id: string;
  width: number;
  height: number;
  elements: DetectedElement[];
  runMetadata: {
    model: string;
    version: string;
    inputs: {
      box_threshold: number;
      iou_threshold: number;
      imgsz: number;
    };
  };
}

/** Crop specification in ORIGINAL pixel coordinates */
export interface CropSpec {
  id: string;
  imageId: string;
  sourceElementId?: string;
  region: BBox;
  label?: string;
  humanAdjusted: boolean;
  updatedAt: string;
}

/** Crop artifact with PNG data and hash */
export interface CropArtifact {
  id: string;
  cropSpecId: string;
  sourceImageId: string;
  /** PNG as base64 (without data: prefix) */
  pngBase64: string;
  /** Data URL for preview */
  dataUrl: string;
  /** SHA-256 hash of PNG bytes */
  contentHash: string;
  dimensions: {
    width: number;
    height: number;
  };
  fileSizeBytes: number;
  createdAt: string;
}

/** Studio session state */
export interface StudioState {
  images: StudioImage[];
  currentImageIndex: number;
  elements: Map<string, DetectedElement[]>; // imageId -> elements
  selectedElementId: string | null;
  crops: Map<string, CropSpec[]>; // imageId -> crops
  artifacts: Map<string, CropArtifact>; // cropSpecId -> artifact
  isLoading: boolean;
  error: string | null;
}
