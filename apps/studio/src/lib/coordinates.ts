/**
 * Coordinate conversion utilities.
 * All geometry in the IR is stored in ORIGINAL pixel coordinates.
 * Display coordinates are used only for UI rendering.
 */

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

/**
 * Convert original pixel coordinates to display coordinates.
 * @param original - BBox in original pixel space
 * @param naturalSize - Original image dimensions
 * @param displaySize - Displayed image dimensions
 */
export function toDisplayCoords(
  original: BBox,
  naturalSize: Dimensions,
  displaySize: Dimensions
): BBox {
  if (displaySize.width === 0 || displaySize.height === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const scaleX = displaySize.width / naturalSize.width;
  const scaleY = displaySize.height / naturalSize.height;

  return {
    x: original.x * scaleX,
    y: original.y * scaleY,
    width: original.width * scaleX,
    height: original.height * scaleY,
  };
}

/**
 * Convert display coordinates to original pixel coordinates.
 * @param display - BBox in display pixel space
 * @param naturalSize - Original image dimensions
 * @param displaySize - Displayed image dimensions
 */
export function toOriginalCoords(
  display: BBox,
  naturalSize: Dimensions,
  displaySize: Dimensions
): BBox {
  if (displaySize.width === 0 || displaySize.height === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const scaleX = naturalSize.width / displaySize.width;
  const scaleY = naturalSize.height / displaySize.height;

  return {
    x: Math.round(display.x * scaleX),
    y: Math.round(display.y * scaleY),
    width: Math.round(display.width * scaleX),
    height: Math.round(display.height * scaleY),
  };
}

/**
 * Clamp a BBox to stay within image bounds.
 * @param bbox - BBox to clamp (in any coordinate space)
 * @param bounds - Maximum dimensions
 */
export function clampBBox(bbox: BBox, bounds: Dimensions): BBox {
  const x = Math.max(0, Math.min(bbox.x, bounds.width - 1));
  const y = Math.max(0, Math.min(bbox.y, bounds.height - 1));
  const width = Math.max(1, Math.min(bbox.width, bounds.width - x));
  const height = Math.max(1, Math.min(bbox.height, bounds.height - y));

  return { x, y, width, height };
}
