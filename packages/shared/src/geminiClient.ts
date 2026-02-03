/**
 * Gemini API Client for style analysis.
 *
 * Uses Gemini 2.0 Flash for agentic vision tasks.
 */

import { z } from "zod";

const GEMINI_MODEL = "gemini-2.0-flash";
const STYLE_ANALYSIS_PROMPT_VERSION = "1.0.0";

/**
 * Gemini client options.
 */
export interface GeminiClientOptions {
  apiKey?: string;
}

/**
 * Image input for style analysis.
 */
export interface StyleAnalysisImage {
  id: string;
  base64: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
}

/**
 * Style analysis response from Gemini.
 */
export interface GeminiStyleAnalysisResponse {
  colors: Array<{
    role: string;
    value: string;
    observedIn: string[];
  }>;
  typography: Array<{
    role: string;
    fontSizePx: number;
    fontWeight: number;
    lineHeight: number | string;
    letterSpacing?: string;
  }>;
  spacing: Array<{
    name: string;
    valuePx: number;
    contexts: string[];
  }>;
  borderRadiusPx: number[];
  shadows: Array<{
    name: string;
    value: string;
  }>;
  zIndex?: Array<{
    name: string;
    value: number;
  }>;
  motion?: Array<{
    name: string;
    duration: string;
    easing?: string;
  }>;
  componentRules: Array<{
    component: string;
    paddingPx: { x: number; y: number };
    borderRadiusPx: number;
    borderWidthPx?: number;
    minHeightPx?: number;
    gapPx?: number;
    notes?: string;
  }>;
  observations: {
    density: "compact" | "comfortable" | "spacious";
    contrast: "low" | "medium" | "high";
    iconStyle?: "outlined" | "filled" | "duotone" | "mixed";
    focusStyle?: string;
    borderStyle?: "none" | "subtle" | "prominent";
  };
  imageReferences: Array<{
    imageId: string;
    supports: string[];
  }>;
}

const STYLE_ANALYSIS_PROMPT = `You are a design system analyzer. Analyze the provided UI screenshots and extract a comprehensive style guide.

Output ONLY valid JSON conforming to this schema:
{
  "colors": [{ "role": "background|surface|surface-elevated|border|border-subtle|text|text-muted|text-inverse|brand|brand-muted|primary|primary-hover|secondary|accent|success|warning|danger|info", "value": "#hex", "observedIn": ["description"] }],
  "typography": [{ "role": "display|heading-1|heading-2|heading-3|heading-4|body|body-small|caption|label|button|code|overline", "fontSizePx": number, "fontWeight": 100-900, "lineHeight": number, "letterSpacing": "0.5px" }],
  "spacing": [{ "name": "xs|sm|md|lg|xl|2xl|3xl", "valuePx": number, "contexts": ["padding", "gap", "margin"] }],
  "borderRadiusPx": [number],
  "shadows": [{ "name": "sm|md|lg|xl", "value": "CSS box-shadow" }],
  "zIndex": [{ "name": "dropdown|modal|tooltip", "value": number }],
  "motion": [{ "name": "fast|normal|slow", "duration": "150ms", "easing": "ease-out" }],
  "componentRules": [{ "component": "button|input|select|checkbox|radio|toggle|card|modal|dropdown|table|nav|tabs|badge|avatar|tooltip|alert", "paddingPx": { "x": number, "y": number }, "borderRadiusPx": number, "borderWidthPx": number, "minHeightPx": number, "gapPx": number, "notes": "string" }],
  "observations": {
    "density": "compact|comfortable|spacious",
    "contrast": "low|medium|high",
    "iconStyle": "outlined|filled|duotone|mixed",
    "focusStyle": "description of focus rings/outlines",
    "borderStyle": "none|subtle|prominent"
  },
  "imageReferences": [{ "imageId": "id", "supports": ["rule descriptions"] }]
}

Guidelines:
- Measure colors precisely using hex values
- Estimate font sizes, weights, and spacing in pixels
- Identify consistent patterns across images
- Note which images support which style rules
- For typography, look at headings, body text, captions, buttons
- For spacing, identify common padding and gap patterns
- For components, extract typical dimensions and styles

Respond with ONLY the JSON object, no markdown or explanation.`;

/**
 * Gemini client for style analysis.
 */
export class GeminiClient {
  private apiKey: string;

  constructor(options: GeminiClientOptions = {}) {
    const apiKey = options.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is required");
    }
    this.apiKey = apiKey;
  }

  /**
   * Analyze images for style extraction.
   */
  async analyzeStyle(
    images: StyleAnalysisImage[]
  ): Promise<{
    analysis: GeminiStyleAnalysisResponse;
    model: string;
    promptVersion: string;
    latencyMs: number;
  }> {
    const startTime = Date.now();

    // Build multimodal request with all images
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      { text: STYLE_ANALYSIS_PROMPT },
    ];

    for (const image of images) {
      parts.push({
        inlineData: {
          mimeType: image.mimeType,
          data: image.base64,
        },
      });
      parts.push({
        text: `Image ID: ${image.id}`,
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.1,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const result = await response.json() as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };
    const latencyMs = Date.now() - startTime;

    // Extract text from response
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("No content in Gemini response");
    }

    // Parse JSON response
    let analysis: GeminiStyleAnalysisResponse;
    try {
      analysis = JSON.parse(text);
    } catch (err) {
      console.error("[Gemini] Failed to parse JSON:", text);
      throw new Error(`Failed to parse Gemini JSON response: ${err}`);
    }

    return {
      analysis,
      model: GEMINI_MODEL,
      promptVersion: STYLE_ANALYSIS_PROMPT_VERSION,
      latencyMs,
    };
  }

  /**
   * Health check - verify API key works.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`,
        { method: "GET" }
      );
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Create a new Gemini client.
 */
export function createGeminiClient(options?: GeminiClientOptions): GeminiClient {
  return new GeminiClient(options);
}
