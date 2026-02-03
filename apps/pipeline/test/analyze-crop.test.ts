/**
 * Test for analyze-crop endpoint.
 *
 * These tests verify that:
 * 1. Full screenshots are rejected (only crops allowed)
 * 2. Invalid requests are properly rejected
 * 3. Missing locked tokens returns appropriate error
 */

import { describe, it, before } from "node:test";
import assert from "node:assert";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { randomUUID, createHash } from "node:crypto";

const PIPELINE_URL = process.env.PIPELINE_URL || "http://localhost:3001";

interface ErrorResponse {
  error: string;
  message?: string;
  cropDimensions?: { width: number; height: number };
  matchedDimensions?: { width: number; height: number };
}

// A minimal 1x1 red PNG for testing
const MINIMAL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";

function computeSha256(base64: string): string {
  const buffer = Buffer.from(base64, "base64");
  return createHash("sha256").update(buffer).digest("hex");
}

describe("Analyze Crop - Full Screenshot Rejection", () => {
  before(async () => {
    // Verify pipeline is running
    const res = await fetch(`${PIPELINE_URL}/api/health`);
    assert.ok(res.ok, "Pipeline should be running");
  });

  it("should reject crop when dimensions match full screenshot dimensions", async () => {
    // Simulate full screenshot dimensions
    const fullScreenshotWidth = 1920;
    const fullScreenshotHeight = 1080;

    const res = await fetch(`${PIPELINE_URL}/api/analyze-crop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        setId: "test-set",
        cropId: randomUUID(),
        cropPngBase64: MINIMAL_PNG_BASE64,
        cropSha256: computeSha256(MINIMAL_PNG_BASE64),
        // Dimensions that match a full screenshot
        width: fullScreenshotWidth,
        height: fullScreenshotHeight,
        styleRunId: randomUUID(),
        fullScreenshotDimensions: [
          { width: fullScreenshotWidth, height: fullScreenshotHeight },
          { width: 1440, height: 900 },
        ],
      }),
    });

    assert.strictEqual(res.status, 400, "Should return 400 for full screenshot dimensions");

    const body = (await res.json()) as ErrorResponse;
    assert.ok(body.error, "Should have error field");
    assert.ok(
      body.error.toLowerCase().includes("full screenshot"),
      'Error should mention "full screenshot"'
    );
    assert.deepStrictEqual(
      body.cropDimensions,
      { width: fullScreenshotWidth, height: fullScreenshotHeight },
      "Should include crop dimensions"
    );
    assert.deepStrictEqual(
      body.matchedDimensions,
      { width: fullScreenshotWidth, height: fullScreenshotHeight },
      "Should include matched dimensions"
    );

    console.log("✅ Correctly rejects crop with full screenshot dimensions (1920x1080)");
  });

  it("should reject crop when dimensions match any full screenshot in the set", async () => {
    // Test against second full screenshot in the list
    const res = await fetch(`${PIPELINE_URL}/api/analyze-crop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        setId: "test-set",
        cropId: randomUUID(),
        cropPngBase64: MINIMAL_PNG_BASE64,
        cropSha256: computeSha256(MINIMAL_PNG_BASE64),
        width: 1440,
        height: 900,
        styleRunId: randomUUID(),
        fullScreenshotDimensions: [
          { width: 1920, height: 1080 },
          { width: 1440, height: 900 }, // This should match
        ],
      }),
    });

    assert.strictEqual(res.status, 400, "Should return 400 for matching second screenshot");

    const body = (await res.json()) as ErrorResponse;
    assert.ok(body.error?.toLowerCase().includes("full screenshot"), "Should reject full screenshot");
    assert.deepStrictEqual(body.matchedDimensions, { width: 1440, height: 900 });

    console.log("✅ Correctly rejects crop matching any full screenshot in set (1440x900)");
  });

  it("should allow crop when dimensions do not match any full screenshot", async () => {
    // This will fail because locked tokens don't exist, but we verify it doesn't
    // fail with "full screenshot rejected" error
    const res = await fetch(`${PIPELINE_URL}/api/analyze-crop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        setId: "test-set",
        cropId: randomUUID(),
        cropPngBase64: MINIMAL_PNG_BASE64,
        cropSha256: computeSha256(MINIMAL_PNG_BASE64),
        width: 200,
        height: 100,
        styleRunId: randomUUID(),
        fullScreenshotDimensions: [
          { width: 1920, height: 1080 },
          { width: 1440, height: 900 },
        ],
      }),
    });

    // Should NOT be 400 with "full screenshot rejected"
    // It will likely be 500 because locked tokens don't exist
    const body = (await res.json()) as ErrorResponse;

    if (res.status === 400 && body.error?.toLowerCase().includes("full screenshot")) {
      assert.fail("Should not reject valid crop dimensions as full screenshot");
    }

    console.log("✅ Correctly allows crop with non-matching dimensions (200x100)");
    console.log(`   (Got status ${res.status} - expected since locked tokens don't exist)`);
  });
});

describe("Analyze Crop - Request Validation", () => {
  it("should return 400 for missing required fields", async () => {
    const res = await fetch(`${PIPELINE_URL}/api/analyze-crop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        setId: "test-set",
        // Missing other required fields
      }),
    });

    assert.strictEqual(res.status, 400, "Should return 400 for missing fields");

    const body = (await res.json()) as ErrorResponse;
    assert.ok(body.error, "Should have error field");
    assert.ok(body.details, "Should have validation details");

    console.log("✅ Correctly returns 400 for missing required fields");
  });

  it("should return 400 for invalid SHA-256 hash", async () => {
    const res = await fetch(`${PIPELINE_URL}/api/analyze-crop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        setId: "test-set",
        cropId: randomUUID(),
        cropPngBase64: MINIMAL_PNG_BASE64,
        cropSha256: "not-a-valid-sha256",
        width: 200,
        height: 100,
        styleRunId: randomUUID(),
        fullScreenshotDimensions: [{ width: 1920, height: 1080 }],
      }),
    });

    assert.strictEqual(res.status, 400, "Should return 400 for invalid SHA-256");

    const body = (await res.json()) as ErrorResponse;
    assert.ok(body.error, "Should have error field");

    console.log("✅ Correctly returns 400 for invalid SHA-256 hash");
  });

  it("should return 400 for invalid cropId (not UUID)", async () => {
    const res = await fetch(`${PIPELINE_URL}/api/analyze-crop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        setId: "test-set",
        cropId: "not-a-uuid",
        cropPngBase64: MINIMAL_PNG_BASE64,
        cropSha256: computeSha256(MINIMAL_PNG_BASE64),
        width: 200,
        height: 100,
        styleRunId: randomUUID(),
        fullScreenshotDimensions: [{ width: 1920, height: 1080 }],
      }),
    });

    assert.strictEqual(res.status, 400, "Should return 400 for invalid cropId");

    const body = (await res.json()) as ErrorResponse;
    assert.ok(body.error, "Should have error field");

    console.log("✅ Correctly returns 400 for invalid cropId (not UUID)");
  });

  it("should return 400 for empty fullScreenshotDimensions array", async () => {
    const res = await fetch(`${PIPELINE_URL}/api/analyze-crop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        setId: "test-set",
        cropId: randomUUID(),
        cropPngBase64: MINIMAL_PNG_BASE64,
        cropSha256: computeSha256(MINIMAL_PNG_BASE64),
        width: 200,
        height: 100,
        styleRunId: randomUUID(),
        fullScreenshotDimensions: [], // Empty array
      }),
    });

    assert.strictEqual(res.status, 400, "Should return 400 for empty dimensions array");

    const body = (await res.json()) as ErrorResponse;
    assert.ok(body.error, "Should have error field");

    console.log("✅ Correctly returns 400 for empty fullScreenshotDimensions array");
  });
});

describe("Analyze Crop - Locked Tokens Requirement", () => {
  it("should return 500 when locked tokens do not exist", async () => {
    const fakeStyleRunId = randomUUID();

    const res = await fetch(`${PIPELINE_URL}/api/analyze-crop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        setId: "test-set",
        cropId: randomUUID(),
        cropPngBase64: MINIMAL_PNG_BASE64,
        cropSha256: computeSha256(MINIMAL_PNG_BASE64),
        width: 200,
        height: 100,
        styleRunId: fakeStyleRunId,
        fullScreenshotDimensions: [{ width: 1920, height: 1080 }],
      }),
    });

    assert.strictEqual(res.status, 500, "Should return 500 when locked tokens not found");

    const body = (await res.json()) as ErrorResponse;
    assert.ok(body.error, "Should have error field");
    assert.ok(
      body.message?.toLowerCase().includes("locked tokens") ||
        body.message?.toLowerCase().includes("not found"),
      "Error should mention locked tokens or not found"
    );

    console.log("✅ Correctly returns 500 when locked tokens do not exist");
  });
});

describe("Analyze Crop - Edge Cases", () => {
  it("should handle exact dimension match (same width and height)", async () => {
    // Test edge case: square crop matching square screenshot
    const res = await fetch(`${PIPELINE_URL}/api/analyze-crop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        setId: "test-set",
        cropId: randomUUID(),
        cropPngBase64: MINIMAL_PNG_BASE64,
        cropSha256: computeSha256(MINIMAL_PNG_BASE64),
        width: 500,
        height: 500,
        styleRunId: randomUUID(),
        fullScreenshotDimensions: [{ width: 500, height: 500 }],
      }),
    });

    assert.strictEqual(res.status, 400, "Should reject exact match");

    const body = (await res.json()) as ErrorResponse;
    assert.ok(body.error?.toLowerCase().includes("full screenshot"));

    console.log("✅ Correctly rejects square crop matching square screenshot (500x500)");
  });

  it("should not confuse width/height swap as a match", async () => {
    // Crop is 1080x1920, screenshots are 1920x1080 - should NOT match
    const res = await fetch(`${PIPELINE_URL}/api/analyze-crop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        setId: "test-set",
        cropId: randomUUID(),
        cropPngBase64: MINIMAL_PNG_BASE64,
        cropSha256: computeSha256(MINIMAL_PNG_BASE64),
        width: 1080, // Swapped
        height: 1920, // Swapped
        styleRunId: randomUUID(),
        fullScreenshotDimensions: [{ width: 1920, height: 1080 }],
      }),
    });

    const body = (await res.json()) as ErrorResponse;

    // Should NOT be rejected as full screenshot
    if (res.status === 400 && body.error?.toLowerCase().includes("full screenshot")) {
      assert.fail("Should not match swapped dimensions (1080x1920 vs 1920x1080)");
    }

    console.log("✅ Correctly does NOT match swapped dimensions (1080x1920 vs 1920x1080)");
  });
});
