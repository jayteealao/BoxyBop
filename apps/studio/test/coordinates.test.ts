import { describe, it, expect } from "vitest";
import {
  toDisplayCoords,
  toOriginalCoords,
  clampBBox,
} from "../src/lib/coordinates";

describe("toDisplayCoords", () => {
  it("converts original coords to display coords with uniform scaling", () => {
    const original = { x: 100, y: 200, width: 50, height: 50 };
    const naturalSize = { width: 1000, height: 1000 };
    const displaySize = { width: 500, height: 500 }; // 50% scale

    const result = toDisplayCoords(original, naturalSize, displaySize);

    expect(result).toEqual({ x: 50, y: 100, width: 25, height: 25 });
  });

  it("handles non-uniform scaling", () => {
    const original = { x: 100, y: 100, width: 200, height: 100 };
    const naturalSize = { width: 1000, height: 500 };
    const displaySize = { width: 500, height: 250 }; // 50% scale both axes

    const result = toDisplayCoords(original, naturalSize, displaySize);

    expect(result).toEqual({ x: 50, y: 50, width: 100, height: 50 });
  });

  it("returns zero bbox when display size is zero", () => {
    const original = { x: 100, y: 100, width: 50, height: 50 };
    const naturalSize = { width: 1000, height: 1000 };
    const displaySize = { width: 0, height: 0 };

    const result = toDisplayCoords(original, naturalSize, displaySize);

    expect(result).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it("handles 1:1 scaling (no change)", () => {
    const original = { x: 100, y: 200, width: 300, height: 400 };
    const naturalSize = { width: 1920, height: 1080 };
    const displaySize = { width: 1920, height: 1080 };

    const result = toDisplayCoords(original, naturalSize, displaySize);

    expect(result).toEqual(original);
  });
});

describe("toOriginalCoords", () => {
  it("converts display coords to original coords with uniform scaling", () => {
    const display = { x: 50, y: 100, width: 25, height: 25 };
    const naturalSize = { width: 1000, height: 1000 };
    const displaySize = { width: 500, height: 500 };

    const result = toOriginalCoords(display, naturalSize, displaySize);

    expect(result).toEqual({ x: 100, y: 200, width: 50, height: 50 });
  });

  it("rounds to integers", () => {
    const display = { x: 33.333, y: 66.666, width: 100, height: 100 };
    const naturalSize = { width: 1000, height: 1000 };
    const displaySize = { width: 500, height: 500 };

    const result = toOriginalCoords(display, naturalSize, displaySize);

    expect(result.x).toBe(67);
    expect(result.y).toBe(133);
  });

  it("returns zero bbox when display size is zero", () => {
    const display = { x: 100, y: 100, width: 50, height: 50 };
    const naturalSize = { width: 1000, height: 1000 };
    const displaySize = { width: 0, height: 0 };

    const result = toOriginalCoords(display, naturalSize, displaySize);

    expect(result).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});

describe("round-trip conversion", () => {
  it("original -> display -> original preserves values (with rounding)", () => {
    const original = { x: 100, y: 200, width: 300, height: 150 };
    const naturalSize = { width: 1920, height: 1080 };
    const displaySize = { width: 960, height: 540 }; // 50% scale

    const display = toDisplayCoords(original, naturalSize, displaySize);
    const recovered = toOriginalCoords(display, naturalSize, displaySize);

    expect(recovered).toEqual(original);
  });

  it("display -> original -> display preserves values", () => {
    const display = { x: 50, y: 100, width: 150, height: 75 };
    const naturalSize = { width: 1920, height: 1080 };
    const displaySize = { width: 960, height: 540 };

    const original = toOriginalCoords(display, naturalSize, displaySize);
    const recovered = toDisplayCoords(original, naturalSize, displaySize);

    // Allow for floating point precision
    expect(recovered.x).toBeCloseTo(display.x, 5);
    expect(recovered.y).toBeCloseTo(display.y, 5);
    expect(recovered.width).toBeCloseTo(display.width, 5);
    expect(recovered.height).toBeCloseTo(display.height, 5);
  });
});

describe("clampBBox", () => {
  it("clamps bbox to stay within bounds", () => {
    const bbox = { x: -10, y: 900, width: 100, height: 200 };
    const bounds = { width: 1000, height: 1000 };

    const result = clampBBox(bbox, bounds);

    expect(result.x).toBe(0); // Clamped from -10
    expect(result.y).toBe(900);
    expect(result.width).toBe(100);
    expect(result.height).toBe(100); // Clamped to fit within bounds
  });

  it("ensures minimum dimensions of 1", () => {
    const bbox = { x: 500, y: 500, width: 0, height: -5 };
    const bounds = { width: 1000, height: 1000 };

    const result = clampBBox(bbox, bounds);

    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
  });

  it("preserves valid bbox unchanged", () => {
    const bbox = { x: 100, y: 100, width: 200, height: 200 };
    const bounds = { width: 1000, height: 1000 };

    const result = clampBBox(bbox, bounds);

    expect(result).toEqual(bbox);
  });
});
