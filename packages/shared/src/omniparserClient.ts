/**
 * OmniParser Client - Thin adapter for OmniParser via Replicate
 *
 * This module provides a Node.js interface to Microsoft's OmniParser v2 model
 * running on Replicate. No local Python dependency required.
 */

import Replicate from "replicate";
import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";

// OmniParser v2 model on Replicate with pinned version
const OMNIPARSER_MODEL = "microsoft/omniparser-v2";
const OMNIPARSER_VERSION =
  "microsoft/omniparser-v2:49cf3d41b8d3aca1360514e83be4c97131ce8f0d99abfc365526d8384caa88df";

/**
 * Replicate input schema for OmniParser v2
 */
export const OmniParserInputSchema = z.object({
  box_threshold: z.number().min(0).max(1).default(0.05),
  iou_threshold: z.number().min(0).max(1).default(0.1),
  imgsz: z.number().int().positive().default(640),
});

export type OmniParserInput = z.infer<typeof OmniParserInputSchema>;

/**
 * Raw bounding box from OmniParser output (original pixel coords)
 */
export const OmniParserBBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

/**
 * Raw element from parsed OmniParser elements string
 */
export const OmniParserRawElementSchema = z.object({
  bbox: z.union([
    OmniParserBBoxSchema,
    z.array(z.number()).length(4), // [x, y, w, h] format
  ]),
  label: z.string().optional(),
  type: z.string().optional(),
  text: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

/**
 * Normalized element with consistent bbox format
 */
export const OmniParserElementSchema = z.object({
  id: z.string(),
  bbox: OmniParserBBoxSchema,
  type: z.string().optional(),
  text: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  source: z.literal("omniparser"),
});

/**
 * OmniParser API response
 */
export const OmniParserResponseSchema = z.object({
  elements: z.array(OmniParserElementSchema),
  width: z.number(),
  height: z.number(),
  annotatedImageUrl: z.string().optional(),
  runMetadata: z.object({
    model: z.string(),
    version: z.string(),
    inputs: OmniParserInputSchema,
  }),
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
  /** Directory to dump raw output on parse failure (for debugging) */
  debugOutputDir?: string;
}

/**
 * Options for parsing a screenshot
 */
export interface ParseOptions {
  /** Minimum confidence threshold for box detection (0-1, default: 0.05) */
  box_threshold?: number;
  /** IOU threshold for NMS (0-1, default: 0.1) */
  iou_threshold?: number;
  /** Image size for processing (default: 640) */
  imgsz?: number;
}

/**
 * Raw output from Replicate OmniParser v2
 */
interface ReplicateOmniParserOutput {
  img?: string; // URL to annotated image
  elements?: string; // JSON string of elements
}

/**
 * OmniParser client for detecting UI elements via Replicate
 */
export class OmniParserClient {
  private replicate: Replicate;
  private debugOutputDir?: string;

  constructor(options: OmniParserClientOptions = {}) {
    const apiToken = options.apiToken || process.env.REPLICATE_API_TOKEN;

    if (!apiToken) {
      throw new Error(
        "REPLICATE_API_TOKEN is required. Set it in environment or pass via options."
      );
    }

    this.replicate = new Replicate({ auth: apiToken });
    this.debugOutputDir = options.debugOutputDir;
  }

  /**
   * Parse a screenshot to detect UI elements
   *
   * @param imageBuffer - Image data as Buffer (PNG, JPEG, WebP)
   * @param imageWidth - Original image width in pixels
   * @param imageHeight - Original image height in pixels
   * @param options - Parse options
   * @returns Detected UI elements with bounding boxes in ORIGINAL pixel coords
   */
  async parseScreenshot(
    imageBuffer: Buffer,
    imageWidth: number,
    imageHeight: number,
    options: ParseOptions = {}
  ): Promise<OmniParserResponse> {
    const inputs = OmniParserInputSchema.parse({
      box_threshold: options.box_threshold ?? 0.05,
      iou_threshold: options.iou_threshold ?? 0.1,
      imgsz: options.imgsz ?? 640,
    });

    console.log("[OmniParser] Running with inputs:", {
      model: OMNIPARSER_MODEL,
      version: OMNIPARSER_VERSION,
      inputs,
      imageSize: { width: imageWidth, height: imageHeight },
    });

    try {
      // Create a File-like object for Replicate
      const imageFile = new File([imageBuffer], "screenshot.png", {
        type: "image/png",
      });

      // Run OmniParser via Replicate
      const output = (await this.replicate.run(OMNIPARSER_VERSION, {
        input: {
          image: imageFile,
          box_threshold: inputs.box_threshold,
          iou_threshold: inputs.iou_threshold,
          imgsz: inputs.imgsz,
        },
      })) as ReplicateOmniParserOutput;

      console.log("[OmniParser] Raw output received:", {
        hasImg: !!output.img,
        hasElements: !!output.elements,
        elementsType: typeof output.elements,
      });

      // Parse elements from JSON string
      const elements = this.parseElements(
        output.elements,
        imageWidth,
        imageHeight
      );

      return {
        elements,
        width: imageWidth,
        height: imageHeight,
        annotatedImageUrl: output.img,
        runMetadata: {
          model: OMNIPARSER_MODEL,
          version: OMNIPARSER_VERSION,
          inputs,
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`OmniParser failed: ${error.message}`);
      }
      throw new Error("OmniParser failed with unknown error");
    }
  }

  /**
   * Parse a screenshot from base64 string
   */
  async parseScreenshotBase64(
    imageBase64: string,
    imageWidth: number,
    imageHeight: number,
    options: ParseOptions = {}
  ): Promise<OmniParserResponse> {
    // Strip data URI prefix if present
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, "base64");
    return this.parseScreenshot(imageBuffer, imageWidth, imageHeight, options);
  }

  /**
   * Parse a screenshot from file path
   */
  async parseScreenshotFromFile(
    filePath: string,
    imageWidth: number,
    imageHeight: number,
    options: ParseOptions = {}
  ): Promise<OmniParserResponse> {
    const imageBuffer = fs.readFileSync(filePath);
    return this.parseScreenshot(imageBuffer, imageWidth, imageHeight, options);
  }

  /**
   * Parse elements JSON string from Replicate output
   */
  private parseElements(
    elementsRaw: string | undefined,
    imageWidth: number,
    imageHeight: number
  ): OmniParserElement[] {
    if (!elementsRaw) {
      console.warn("[OmniParser] No elements in output");
      return [];
    }

    try {
      const parsed = JSON.parse(elementsRaw);

      if (!Array.isArray(parsed)) {
        throw new Error("Elements is not an array");
      }

      return parsed.map((el: unknown, index: number) => {
        const raw = OmniParserRawElementSchema.parse(el);
        const bbox = this.normalizeBBox(raw.bbox, imageWidth, imageHeight);

        return {
          id: `omni-${index}`,
          bbox,
          type: raw.type || raw.label,
          text: raw.text,
          confidence: raw.confidence,
          source: "omniparser" as const,
        };
      });
    } catch (error) {
      // Persist raw string to disk for inspection
      this.dumpFailedParse(elementsRaw, error);

      const message =
        error instanceof Error ? error.message : "Unknown parse error";
      throw new Error(
        `Failed to parse OmniParser elements: ${message}. Raw output dumped for inspection.`
      );
    }
  }

  /**
   * Normalize bbox to consistent {x, y, width, height} format
   * Ensures coordinates are in ORIGINAL pixel space
   */
  private normalizeBBox(
    bbox: z.infer<typeof OmniParserBBoxSchema> | number[],
    imageWidth: number,
    imageHeight: number
  ): OmniParserBBox {
    if (Array.isArray(bbox)) {
      // Format: [x, y, w, h] - could be normalized (0-1) or pixel coords
      let [x, y, w, h] = bbox;

      // If values are all <= 1, assume normalized coords
      if (x <= 1 && y <= 1 && w <= 1 && h <= 1) {
        x = Math.round(x * imageWidth);
        y = Math.round(y * imageHeight);
        w = Math.round(w * imageWidth);
        h = Math.round(h * imageHeight);
      }

      return { x, y, width: w, height: h };
    }

    // Already in correct format - verify it's in pixel space
    let { x, y, width, height } = bbox;

    if (x <= 1 && y <= 1 && width <= 1 && height <= 1) {
      // Normalized coords, convert to pixels
      x = Math.round(x * imageWidth);
      y = Math.round(y * imageHeight);
      width = Math.round(width * imageWidth);
      height = Math.round(height * imageHeight);
    }

    return { x, y, width, height };
  }

  /**
   * Dump failed parse output to disk for debugging
   */
  private dumpFailedParse(rawOutput: string, error: unknown): void {
    const outputDir = this.debugOutputDir || "/tmp/omniparser-debug";

    try {
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const dumpPath = path.join(outputDir, `parse-failure-${timestamp}.json`);

      const dumpContent = JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : String(error),
          rawOutput,
        },
        null,
        2
      );

      fs.writeFileSync(dumpPath, dumpContent);
      console.error(`[OmniParser] Raw output dumped to: ${dumpPath}`);
    } catch (dumpError) {
      console.error("[OmniParser] Failed to dump raw output:", dumpError);
    }
  }

  /**
   * Check if Replicate API is accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
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
