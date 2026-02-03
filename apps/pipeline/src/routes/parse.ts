import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import * as fs from "node:fs";
import {
  createOmniParserClient,
  type OmniParserResponse,
} from "@boxybop/shared";
import { getEnv } from "../config/env.js";

export const parseRouter: IRouter = Router();

/**
 * Request body schema for parse endpoint
 */
const ParseRequestSchema = z.union([
  z.object({
    image_id: z.string().min(1),
    image_png_base64: z.string().min(1),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    box_threshold: z.number().min(0).max(1).optional(),
    iou_threshold: z.number().min(0).max(1).optional(),
    imgsz: z.number().int().positive().optional(),
  }),
  z.object({
    image_id: z.string().min(1),
    path_on_disk: z.string().min(1),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    box_threshold: z.number().min(0).max(1).optional(),
    iou_threshold: z.number().min(0).max(1).optional(),
    imgsz: z.number().int().positive().optional(),
  }),
]);

type ParseRequest = z.infer<typeof ParseRequestSchema>;

/**
 * Response schema for parse endpoint
 */
const ParseResponseSchema = z.object({
  image_id: z.string(),
  width: z.number(),
  height: z.number(),
  elements: z.array(
    z.object({
      id: z.string(),
      bbox: z.object({
        x: z.number(),
        y: z.number(),
        w: z.number(),
        h: z.number(),
      }),
      type: z.string().optional(),
      text: z.string().optional(),
      confidence: z.number().optional(),
      source: z.string(),
    })
  ),
  runMetadata: z.object({
    model: z.string(),
    version: z.string(),
    inputs: z.object({
      box_threshold: z.number(),
      iou_threshold: z.number(),
      imgsz: z.number(),
    }),
  }),
});

type ParseResponse = z.infer<typeof ParseResponseSchema>;

/**
 * Transform OmniParser response to API response format
 */
function transformResponse(
  imageId: string,
  response: OmniParserResponse
): ParseResponse {
  return {
    image_id: imageId,
    width: response.width,
    height: response.height,
    elements: response.elements.map((el) => ({
      id: el.id,
      bbox: {
        x: el.bbox.x,
        y: el.bbox.y,
        w: el.bbox.width,
        h: el.bbox.height,
      },
      type: el.type,
      text: el.text,
      confidence: el.confidence,
      source: el.source,
    })),
    runMetadata: response.runMetadata,
  };
}

/**
 * POST /api/parse
 *
 * Parse an image using OmniParser to detect UI elements.
 *
 * Input: { image_id, image_png_base64, width, height } or { image_id, path_on_disk, width, height }
 * Output: { image_id, width, height, elements:[{id,bbox:{x,y,w,h}, type?, text?, confidence?, source}] }
 *
 * bbox coordinates are in ORIGINAL pixel space.
 */
parseRouter.post("/", async (req: Request, res: Response): Promise<void> => {
  // Validate request body first (before checking service availability)
  const parseResult = ParseRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: "Invalid request",
      details: parseResult.error.issues,
    });
    return;
  }

  const env = getEnv();

  // Check if Replicate is configured
  if (!env.REPLICATE_API_TOKEN) {
    res.status(503).json({
      error: "OmniParser not available",
      message: "REPLICATE_API_TOKEN is not configured",
    });
    return;
  }

  const body = parseResult.data;
  const { image_id, width, height, box_threshold, iou_threshold, imgsz } = body;

  console.log(`[Parse] Processing image ${image_id} (${width}x${height})`);

  try {
    const client = createOmniParserClient({
      apiToken: env.REPLICATE_API_TOKEN,
    });

    let response: OmniParserResponse;

    if ("image_png_base64" in body) {
      // Parse from base64
      response = await client.parseScreenshotBase64(
        body.image_png_base64,
        width,
        height,
        { box_threshold, iou_threshold, imgsz }
      );
    } else {
      // Parse from file path
      if (!fs.existsSync(body.path_on_disk)) {
        res.status(400).json({
          error: "File not found",
          path: body.path_on_disk,
        });
        return;
      }

      response = await client.parseScreenshotFromFile(
        body.path_on_disk,
        width,
        height,
        { box_threshold, iou_threshold, imgsz }
      );
    }

    const result = transformResponse(image_id, response);

    console.log(
      `[Parse] Completed ${image_id}: found ${result.elements.length} elements`
    );
    console.log(`[Parse] Run metadata:`, result.runMetadata);

    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Parse] Failed for ${image_id}:`, message);

    res.status(500).json({
      error: "Parse failed",
      message,
      image_id,
    });
  }
});
