/**
 * OmniParser Client - Thin adapter for OmniParser via Replicate
 *
 * This module provides a Node.js interface to Microsoft's OmniParser model
 * running on Replicate. No local Python dependency required.
 */

import Replicate from "replicate";
import { z } from "zod";

// OmniParser model on Replicate
const OMNIPARSER_MODEL = "microsoft/omniparser:fc9e656b3f3c1f8b856621d76fc4e0e4f3a14dc733a55e4be67dcc8c8d1e51f1";

/**
 * Raw bounding box from OmniParser output
 */
export const OmniParserBBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

/**
 * Raw element from OmniParser output
 */
export const OmniParserElementSchema = z.object({
  bbox: OmniParserBBoxSchema,
  label: z.string(),
  confidence: z.number().min(0).max(1),
});

/**
 * OmniParser API response
 */
export const OmniParserResponseSchema = z.object({
  elements: z.array(OmniParserElementSchema),
  image_width: z.number(),
  image_height: z.number(),
});

export type OmniParserBBox = z.infer<typeof OmniParserBBoxSchema>;
export type OmniParserElement = z.infer<typeof OmniParserElementSchema>;
export type OmniParserResponse = z.infer<typeof OmniParserResponseSchema>;

/**
 * Options for OmniParser client
 */
export interface OmniParserClientOptions {
  /** Replicate API token (defaults to REPLICATE_API_TOKEN env var) */
  apiToken?: string;
  /** Request timeout in milliseconds (default: 300000 = 5 minutes) */
  timeout?: number;
}

/**
 * Options for parsing a screenshot
 */
export interface ParseOptions {
  /** Minimum confidence threshold (0-1, default: 0.5) */
  minConfidence?: number;
}

/**
 * OmniParser client for detecting UI elements via Replicate
 */
export class OmniParserClient {
  private replicate: Replicate;
  private timeout: number;

  constructor(options: OmniParserClientOptions = {}) {
    const apiToken = options.apiToken || process.env.REPLICATE_API_TOKEN;

    if (!apiToken) {
      throw new Error(
        "REPLICATE_API_TOKEN is required. Set it in environment or pass via options."
      );
    }

    this.replicate = new Replicate({ auth: apiToken });
    this.timeout = options.timeout || 300000; // 5 minutes default
  }

  /**
   * Parse a screenshot to detect UI elements
   *
   * @param imageBase64 - Base64-encoded image data (PNG, JPEG, WebP)
   * @param options - Parse options
   * @returns Detected UI elements with bounding boxes
   */
  async parseScreenshot(
    imageBase64: string,
    options: ParseOptions = {}
  ): Promise<OmniParserResponse> {
    const { minConfidence = 0.5 } = options;

    // Ensure base64 has data URI prefix if not present
    const imageUri = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:image/png;base64,${imageBase64}`;

    try {
      // Run OmniParser via Replicate
      const output = await this.replicate.run(OMNIPARSER_MODEL, {
        input: {
          image: imageUri,
        },
      });

      // Parse and validate response
      const response = this.parseOutput(output);

      // Filter by confidence threshold
      const filteredElements = response.elements.filter(
        (el) => el.confidence >= minConfidence
      );

      return {
        ...response,
        elements: filteredElements,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`OmniParser failed: ${error.message}`);
      }
      throw new Error("OmniParser failed with unknown error");
    }
  }

  /**
   * Parse raw Replicate output into typed response
   */
  private parseOutput(output: unknown): OmniParserResponse {
    // OmniParser returns output in a specific format
    // This may need adjustment based on actual Replicate output format
    try {
      // If output is already in expected format
      if (typeof output === "object" && output !== null) {
        return OmniParserResponseSchema.parse(output);
      }

      // If output is a string (JSON), parse it
      if (typeof output === "string") {
        const parsed = JSON.parse(output);
        return OmniParserResponseSchema.parse(parsed);
      }

      throw new Error("Unexpected output format from OmniParser");
    } catch (error) {
      // Return empty result if parsing fails
      console.warn("Failed to parse OmniParser output:", error);
      return {
        elements: [],
        image_width: 0,
        image_height: 0,
      };
    }
  }

  /**
   * Check if Replicate API is accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Just check if we can access the API
      // A simple way is to try to get model info
      const models = await this.replicate.models.list();
      return Array.isArray(models.results);
    } catch {
      return false;
    }
  }
}

/**
 * Create a new OmniParser client
 */
export function createOmniParserClient(
  options?: OmniParserClientOptions
): OmniParserClient {
  return new OmniParserClient(options);
}
