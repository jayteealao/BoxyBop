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
const CROP_ANALYSIS_PROMPT_VERSION = "1.0.0";

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
 * Input for crop analysis.
 */
export interface CropAnalysisInput {
  /** Crop image as base64 PNG */
  base64: string;
  /** Crop ID */
  cropId: string;
  /** Set ID */
  setId: string;
  /** SHA-256 hash of the crop PNG */
  cropHash: string;
  /** Crop dimensions */
  width: number;
  height: number;
  /** Locked tokens to reference */
  lockedTokens: {
    styleRunId: string;
    tokensHash: string;
    tokens: {
      colors: Array<{ cssVar: string; value: string; role: string }>;
      typography: Array<{ cssVar: string; fontSize: string; fontWeight: number }>;
      spacing: Array<{ cssVar: string; value: string }>;
      radius: Array<{ cssVar: string; value: string }>;
      shadows: Array<{ cssVar: string; value: string }>;
    };
  };
}

/**
 * Raw response from Gemini crop analysis.
 */
export interface GeminiCropAnalysisResponse {
  description: string;
  suggestedComponentName?: string;
  category: string;
  elements: Array<{
    type: string;
    description: string;
    bounds?: {
      xPercent: number;
      yPercent: number;
      widthPercent: number;
      heightPercent: number;
    };
    tokenRefs: Array<{
      cssVar: string;
      context: string;
      confidence: number;
    }>;
  }>;
  colorTokensUsed: Array<{ cssVar: string; context: string; confidence: number }>;
  typographyTokensUsed: Array<{ cssVar: string; context: string; confidence: number }>;
  spacingTokensUsed: Array<{ cssVar: string; context: string; confidence: number }>;
  radiusTokensUsed: Array<{ cssVar: string; context: string; confidence: number }>;
  shadowTokensUsed: Array<{ cssVar: string; context: string; confidence: number }>;
  states: string[];
  variants: string[];
  observations: {
    alignment?: string;
    density?: string;
    hasInteractiveIndicators?: boolean;
    notes?: string;
  };
}

/**
 * Build the crop analysis prompt with locked tokens.
 */
function buildCropAnalysisPrompt(lockedTokens: CropAnalysisInput["lockedTokens"]): string {
  const tokensSection = `
## Locked Design Tokens (use these CSS variables in your analysis)

### Colors
${lockedTokens.tokens.colors.map((c) => `- ${c.cssVar}: ${c.value} (${c.role})`).join("\n")}

### Typography
${lockedTokens.tokens.typography.map((t) => `- ${t.cssVar}: ${t.fontSize}, weight ${t.fontWeight}`).join("\n")}

### Spacing
${lockedTokens.tokens.spacing.map((s) => `- ${s.cssVar}: ${s.value}`).join("\n")}

### Border Radius
${lockedTokens.tokens.radius.map((r) => `- ${r.cssVar}: ${r.value}`).join("\n")}

### Shadows
${lockedTokens.tokens.shadows.map((s) => `- ${s.cssVar}: ${s.value}`).join("\n")}
`;

  return `You are a UI component analyzer. Analyze this cropped UI element and describe what you see using ONLY the locked design tokens provided below.

${tokensSection}

CRITICAL: You must reference the provided CSS variable names (e.g., --color-primary, --space-4) when describing colors, typography, spacing, radius, and shadows. Do NOT invent new tokens or use raw values.

Analyze the cropped image and output ONLY valid JSON conforming to this schema:
{
  "description": "High-level description of what this UI element is",
  "suggestedComponentName": "PascalCase component name (e.g., PrimaryButton, SearchInput)",
  "category": "layout|navigation|form|feedback|data-display|overlay|typography|media|composite",
  "elements": [{
    "type": "button|input|text|icon|image|badge|avatar|card|container|divider|checkbox|radio|toggle|dropdown|other",
    "description": "What this element is",
    "bounds": { "xPercent": 0-100, "yPercent": 0-100, "widthPercent": 0-100, "heightPercent": 0-100 },
    "tokenRefs": [{ "cssVar": "--token-name", "context": "background|border|text|fill|etc", "confidence": 0-1 }]
  }],
  "colorTokensUsed": [{ "cssVar": "--color-*", "context": "where used", "confidence": 0-1 }],
  "typographyTokensUsed": [{ "cssVar": "--text-*", "context": "where used", "confidence": 0-1 }],
  "spacingTokensUsed": [{ "cssVar": "--space-*", "context": "padding|margin|gap", "confidence": 0-1 }],
  "radiusTokensUsed": [{ "cssVar": "--radius-*", "context": "which corners", "confidence": 0-1 }],
  "shadowTokensUsed": [{ "cssVar": "--shadow-*", "context": "where applied", "confidence": 0-1 }],
  "states": ["default", "hover", "active", "focus", "disabled", "loading"],
  "variants": ["primary", "secondary", "outline", etc.],
  "observations": {
    "alignment": "left|center|right|justified|mixed",
    "density": "compact|comfortable|spacious",
    "hasInteractiveIndicators": true/false,
    "notes": "any additional observations"
  }
}

Guidelines:
- Match colors to the closest locked color token
- Match font sizes and weights to locked typography tokens
- Match spacing values to locked spacing tokens
- Match corner rounding to locked radius tokens
- If you can't find a matching token, note it in observations.notes
- Confidence should reflect how certain you are about the token match (1.0 = exact match, 0.5 = approximate)

Output ONLY the JSON object with no additional text or markdown.`;
}

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
   * Analyze a crop using locked tokens as reference.
   *
   * The model will describe what it sees using only the provided locked tokens.
   */
  async analyzeCrop(
    input: CropAnalysisInput
  ): Promise<{
    analysis: GeminiCropAnalysisResponse;
    model: string;
    promptVersion: string;
    latencyMs: number;
  }> {
    const startTime = Date.now();

    // Build the prompt with locked tokens
    const prompt = buildCropAnalysisPrompt(input.lockedTokens);

    // Build multimodal content
    type ContentPart = { text: string } | { inlineData: { mimeType: string; data: string } };
    const contents: ContentPart[] = [
      {
        inlineData: {
          mimeType: "image/png",
          data: input.base64,
        },
      },
      {
        text: `[Crop ID: ${input.cropId}, Dimensions: ${input.width}x${input.height}]`,
      },
      {
        text: prompt,
      },
    ];

    console.log(`[Gemini] Analyzing crop ${input.cropId} (${input.width}x${input.height}) with locked tokens`);

    // Call Gemini with Code Execution enabled
    const response = await this.ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: {
        tools: [{ codeExecution: {} }],
        thinkingConfig: {
          thinkingLevel: this.thinkingLevel,
        },
        temperature: 0.1,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
      },
    });

    const latencyMs = Date.now() - startTime;

    // Extract text response
    const parts = response?.candidates?.[0]?.content?.parts || [];
    let analysisText = "";

    for (const part of parts) {
      if ("text" in part && part.text) {
        analysisText += part.text;
      }
    }

    if (!analysisText) {
      throw new Error("No content in Gemini crop analysis response");
    }

    // Extract JSON from response
    let jsonText = analysisText;

    const jsonMatch = analysisText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    } else {
      const jsonStartIndex = analysisText.indexOf("{");
      const jsonEndIndex = analysisText.lastIndexOf("}");
      if (jsonStartIndex !== -1 && jsonEndIndex !== -1 && jsonEndIndex > jsonStartIndex) {
        jsonText = analysisText.slice(jsonStartIndex, jsonEndIndex + 1);
      }
    }

    // Parse JSON response
    let analysis: GeminiCropAnalysisResponse;
    try {
      analysis = JSON.parse(jsonText);
    } catch (err) {
      console.error("[Gemini] Failed to parse crop analysis JSON:", jsonText.slice(0, 500));
      throw new Error(`Failed to parse Gemini crop analysis response: ${err}`);
    }

    console.log(`[Gemini] Crop analysis complete in ${latencyMs}ms:`, {
      suggestedName: analysis.suggestedComponentName,
      category: analysis.category,
      elements: analysis.elements?.length ?? 0,
      colorTokens: analysis.colorTokensUsed?.length ?? 0,
    });

    return {
      analysis,
      model: GEMINI_MODEL,
      promptVersion: CROP_ANALYSIS_PROMPT_VERSION,
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
