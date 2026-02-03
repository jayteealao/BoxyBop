/**
 * Gemini API Client for style analysis.
 *
 * Uses Gemini 3.0 Flash with Agentic Vision (Code Execution) for
 * precise visual analysis. The model can generate and execute code
 * to zoom, crop, measure, and analyze images step-by-step.
 *
 * @see https://ai.google.dev/gemini-api/docs/code-execution
 */

import { GoogleGenAI, ThinkingLevel } from "@google/genai";

const GEMINI_MODEL = "gemini-3-flash-preview";
const STYLE_ANALYSIS_PROMPT_VERSION = "2.0.0";

/**
 * Gemini client options.
 */
export interface GeminiClientOptions {
  apiKey?: string;
  /** Thinking level for agentic reasoning (default: HIGH) */
  thinkingLevel?: ThinkingLevel;
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

const STYLE_ANALYSIS_PROMPT = `You are a design system analyzer with agentic vision capabilities.
Analyze the provided UI screenshots and extract a comprehensive style guide.

Use code execution to precisely measure colors, fonts, spacing, and visual elements.
You can write and execute Python code to:
- Sample exact pixel colors at specific coordinates
- Measure distances between elements
- Identify consistent patterns
- Calculate typography metrics

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
- Use code execution to sample colors precisely from the images
- Measure exact pixel distances for spacing patterns
- Analyze font rendering to estimate sizes and weights
- Identify consistent patterns across all provided images
- Note which images support which style rules in imageReferences

IMPORTANT: After your analysis, output ONLY the final JSON object with no additional text or markdown.`;

/**
 * Gemini client for style analysis using Agentic Vision.
 */
export class GeminiClient {
  private ai: GoogleGenAI;
  private thinkingLevel: ThinkingLevel;

  constructor(options: GeminiClientOptions = {}) {
    const apiKey = options.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is required");
    }
    this.ai = new GoogleGenAI({ apiKey });
    this.thinkingLevel = options.thinkingLevel || ThinkingLevel.HIGH;
  }

  /**
   * Analyze images for style extraction using Agentic Vision.
   *
   * Enables Code Execution tool for precise visual measurements.
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

    // Build multimodal content with images and prompt
    type ContentPart = { text: string } | { inlineData: { mimeType: string; data: string } };
    const contents: ContentPart[] = [];

    // Add images with their IDs
    for (const image of images) {
      contents.push({
        inlineData: {
          mimeType: image.mimeType,
          data: image.base64,
        },
      });
      contents.push({
        text: `[Image ID: ${image.id}]`,
      });
    }

    // Add the analysis prompt
    contents.push({
      text: STYLE_ANALYSIS_PROMPT,
    });

    console.log(`[Gemini] Analyzing ${images.length} images with Agentic Vision (${GEMINI_MODEL})`);

    // Call Gemini with Code Execution enabled for Agentic Vision
    const response = await this.ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: {
        // Enable Code Execution for Agentic Vision
        tools: [{ codeExecution: {} }],
        // Set thinking level for deeper reasoning
        thinkingConfig: {
          thinkingLevel: this.thinkingLevel,
        },
        // Configure output
        temperature: 0.1,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 16384,
      },
    });

    const latencyMs = Date.now() - startTime;

    // Extract text and code execution results
    const parts = response?.candidates?.[0]?.content?.parts || [];
    let analysisText = "";
    let codeExecuted = false;

    for (const part of parts) {
      if ("text" in part && part.text) {
        analysisText += part.text;
      }
      if ("executableCode" in part && part.executableCode) {
        console.log("[Gemini] Executed code for analysis");
        codeExecuted = true;
      }
      if ("codeExecutionResult" in part && part.codeExecutionResult) {
        const output = part.codeExecutionResult.output;
        if (output) {
          console.log("[Gemini] Code execution output:", output.slice(0, 100));
        }
      }
    }

    if (codeExecuted) {
      console.log("[Gemini] Used Agentic Vision code execution for precise measurements");
    }

    if (!analysisText) {
      throw new Error("No content in Gemini response");
    }

    // Extract JSON from response (may be wrapped in markdown or have preamble)
    let jsonText = analysisText;

    // Try to extract JSON from code block if present
    const jsonMatch = analysisText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    } else {
      // Try to find JSON object directly
      const jsonStartIndex = analysisText.indexOf("{");
      const jsonEndIndex = analysisText.lastIndexOf("}");
      if (jsonStartIndex !== -1 && jsonEndIndex !== -1 && jsonEndIndex > jsonStartIndex) {
        jsonText = analysisText.slice(jsonStartIndex, jsonEndIndex + 1);
      }
    }

    // Parse JSON response
    let analysis: GeminiStyleAnalysisResponse;
    try {
      analysis = JSON.parse(jsonText);
    } catch (err) {
      console.error("[Gemini] Failed to parse JSON:", jsonText.slice(0, 500));
      throw new Error(`Failed to parse Gemini JSON response: ${err}`);
    }

    console.log(`[Gemini] Analysis complete in ${latencyMs}ms:`, {
      colors: analysis.colors?.length ?? 0,
      typography: analysis.typography?.length ?? 0,
      spacing: analysis.spacing?.length ?? 0,
      componentRules: analysis.componentRules?.length ?? 0,
    });

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
      // Simple test request
      const response = await this.ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: "Reply with: OK",
        config: {
          maxOutputTokens: 10,
        },
      });
      return !!response?.candidates?.[0]?.content?.parts?.[0];
    } catch (err) {
      console.error("[Gemini] Health check failed:", err);
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
