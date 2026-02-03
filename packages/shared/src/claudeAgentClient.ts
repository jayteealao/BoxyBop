/**
 * Claude Agent SDK Client for style refinement.
 *
 * Uses the Claude Agent SDK to refine Gemini's raw style analysis
 * into locked, production-ready tokens.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import type {
  StyleAnalysisGemini,
  StyleGuideLocked,
  LockedTokens,
  LockedComponentGuide,
  StyleRule,
} from "@boxybop/ir";
import { createHash } from "crypto";

const REFINEMENT_PROMPT_VERSION = "1.0.0";
const CLAUDE_MODEL = "claude-opus-4-1-20250805";

/**
 * Claude Agent SDK client options.
 */
export interface ClaudeAgentClientOptions {
  /** API key (optional if already authenticated via Claude Code) */
  apiKey?: string;
  /** Model to use (defaults to Claude Opus) */
  model?: string;
}

/**
 * Input for style refinement.
 */
export interface StyleRefinementInput {
  /** Gemini style analysis */
  geminiAnalysis: StyleAnalysisGemini;
  /** Style run ID */
  styleRunId: string;
}

/**
 * Result of style refinement.
 */
export interface StyleRefinementResult {
  /** Locked style guide */
  styleGuide: StyleGuideLocked;
  /** Latency in milliseconds */
  latencyMs: number;
}

const STYLE_REFINEMENT_PROMPT = `You are a design system expert. Your task is to refine raw style analysis into production-ready design tokens.

Given the Gemini style analysis below, produce a locked style guide with:

1. **Tokens**: Convert all values to CSS custom properties with semantic names:
   - Colors: --color-{role} (e.g., --color-background, --color-primary)
   - Typography: --text-{role}-{property} (e.g., --text-heading-1-size)
   - Spacing: --space-{scale} (e.g., --space-1, --space-2, up to --space-8)
   - Radius: --radius-{scale} (e.g., --radius-sm, --radius-md)
   - Shadows: --shadow-{scale} (e.g., --shadow-sm, --shadow-lg)
   - Borders: --border-{variant} (e.g., --border-default, --border-subtle)
   - Z-index: --z-{layer} (e.g., --z-dropdown, --z-modal)
   - Motion: --duration-{speed}, --easing-{type}

2. **Component Guides**: For each component type, specify:
   - Which tokens to reference
   - Padding using token vars (e.g., "var(--space-3) var(--space-4)")
   - Border radius using token vars
   - Do/don't rules based on observations

3. **General Rules**: Extract do/don't guidelines from observations:
   - Density patterns (compact/comfortable/spacious)
   - Contrast expectations
   - Icon usage patterns
   - Focus state requirements

4. **Assumptions**: List any assumptions made when reconciling ambiguous data

Output ONLY valid JSON matching this schema:
{
  "tokens": {
    "colors": [{ "name": "string", "cssVar": "--color-*", "value": "#hex", "role": "string" }],
    "typography": [{ "name": "string", "cssVar": "--text-*", "fontSize": "string", "fontWeight": number, "lineHeight": number|string, "letterSpacing": "string" }],
    "spacing": [{ "name": "string", "cssVar": "--space-*", "value": "string" }],
    "radius": [{ "name": "string", "cssVar": "--radius-*", "value": "string" }],
    "shadows": [{ "name": "string", "cssVar": "--shadow-*", "value": "string" }],
    "borders": [{ "name": "string", "cssVar": "--border-*", "width": "string", "style": "solid|dashed|dotted|none", "color": "string" }],
    "zIndex": [{ "name": "string", "cssVar": "--z-*", "value": number }],
    "motion": [{ "name": "string", "cssVar": "--duration-*|--easing-*", "duration": "string", "easing": "string" }]
  },
  "componentGuides": [{
    "component": "button|input|select|checkbox|radio|toggle|card|modal|dropdown|table|nav|tabs|badge|avatar|tooltip|alert",
    "tokenRefs": ["--color-primary", "..."],
    "padding": "var(--space-2) var(--space-4)",
    "borderRadius": "var(--radius-md)",
    "minHeight": "var(--space-10)",
    "rules": [{ "type": "do|dont", "description": "string", "example": "string" }]
  }],
  "generalRules": [{ "type": "do|dont", "description": "string" }],
  "density": "compact|comfortable|spacious",
  "contrast": "low|medium|high",
  "iconStyle": "outlined|filled|duotone|mixed",
  "focusStyle": "description of focus rings",
  "references": [{ "imageId": "string", "supports": ["rule descriptions"] }],
  "assumptions": ["string"]
}

Be precise. Use exact pixel values converted to rem where appropriate (1rem = 16px).
Ensure all tokens follow a consistent naming convention.
Respond with ONLY the JSON object, no markdown or explanation.`;

/**
 * Compute SHA-256 hash of tokens for integrity verification.
 */
function computeTokensHash(tokens: LockedTokens): string {
  const normalized = JSON.stringify(tokens, Object.keys(tokens).sort());
  return createHash("sha256").update(normalized).digest("hex");
}

/**
 * Parse Claude's response into typed structures.
 */
interface RawClaudeResponse {
  tokens: {
    colors: Array<{ name: string; cssVar: string; value: string; role: string }>;
    typography: Array<{
      name: string;
      cssVar: string;
      fontSize: string;
      fontWeight: number;
      lineHeight: number | string;
      letterSpacing?: string;
    }>;
    spacing: Array<{ name: string; cssVar: string; value: string }>;
    radius: Array<{ name: string; cssVar: string; value: string }>;
    shadows: Array<{ name: string; cssVar: string; value: string }>;
    borders: Array<{
      name: string;
      cssVar: string;
      width: string;
      style: "solid" | "dashed" | "dotted" | "none";
      color?: string;
    }>;
    zIndex: Array<{ name: string; cssVar: string; value: number }>;
    motion: Array<{
      name: string;
      cssVar: string;
      duration: string;
      easing?: string;
    }>;
  };
  componentGuides: Array<{
    component: string;
    tokenRefs: string[];
    padding: string;
    borderRadius: string;
    minHeight?: string;
    rules: Array<{ type: "do" | "dont"; description: string; example?: string }>;
  }>;
  generalRules: Array<{ type: "do" | "dont"; description: string }>;
  density: "compact" | "comfortable" | "spacious";
  contrast: "low" | "medium" | "high";
  iconStyle?: "outlined" | "filled" | "duotone" | "mixed";
  focusStyle?: string;
  references: Array<{ imageId: string; supports: string[] }>;
  assumptions: string[];
}

/**
 * Claude Agent SDK client for style refinement.
 */
export class ClaudeAgentClient {
  private model: string;

  constructor(options: ClaudeAgentClientOptions = {}) {
    this.model = options.model || CLAUDE_MODEL;

    // Set API key in environment if provided
    if (options.apiKey && !process.env.ANTHROPIC_API_KEY) {
      process.env.ANTHROPIC_API_KEY = options.apiKey;
    }
  }

  /**
   * Refine Gemini style analysis into locked tokens.
   */
  async refineStyle(input: StyleRefinementInput): Promise<StyleRefinementResult> {
    const startTime = Date.now();

    const { geminiAnalysis, styleRunId } = input;

    // Build the prompt with Gemini analysis data
    const analysisJson = JSON.stringify(geminiAnalysis, null, 2);
    const fullPrompt = `${STYLE_REFINEMENT_PROMPT}

## Gemini Style Analysis

\`\`\`json
${analysisJson}
\`\`\`

Produce the locked style guide JSON:`;

    // Collect all messages from the agent
    let responseText = "";

    for await (const message of query({
      prompt: fullPrompt,
      options: {
        allowedTools: [], // No tools needed - just text generation
        model: this.model,
      },
    })) {
      if (message.type === "assistant" && message.message?.content) {
        for (const block of message.message.content) {
          if ("text" in block && typeof block.text === "string") {
            responseText += block.text;
          }
        }
      }
    }

    const latencyMs = Date.now() - startTime;

    // Parse the JSON response
    let rawResponse: RawClaudeResponse;
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : responseText.trim();
      rawResponse = JSON.parse(jsonStr);
    } catch (err) {
      console.error("[ClaudeAgent] Failed to parse response:", responseText);
      throw new Error(`Failed to parse Claude response: ${err}`);
    }

    // Convert to typed locked tokens
    const tokens: LockedTokens = {
      colors: rawResponse.tokens.colors.map((c) => ({
        name: c.name,
        cssVar: c.cssVar,
        value: c.value,
        role: c.role as LockedTokens["colors"][number]["role"],
      })),
      typography: rawResponse.tokens.typography.map((t) => ({
        name: t.name,
        cssVar: t.cssVar,
        fontSize: t.fontSize,
        fontWeight: t.fontWeight,
        lineHeight: t.lineHeight,
        letterSpacing: t.letterSpacing,
      })),
      spacing: rawResponse.tokens.spacing,
      radius: rawResponse.tokens.radius,
      shadows: rawResponse.tokens.shadows,
      borders: rawResponse.tokens.borders,
      zIndex: rawResponse.tokens.zIndex,
      motion: rawResponse.tokens.motion.map((m) => ({
        name: m.name,
        cssVar: m.cssVar,
        duration: m.duration,
        easing: m.easing,
      })),
    };

    // Compute integrity hash
    const tokensHash = computeTokensHash(tokens);

    // Build component guides
    const componentGuides: LockedComponentGuide[] = rawResponse.componentGuides.map((cg) => ({
      component: cg.component as LockedComponentGuide["component"],
      tokenRefs: cg.tokenRefs,
      padding: cg.padding,
      borderRadius: cg.borderRadius,
      minHeight: cg.minHeight,
      rules: cg.rules as StyleRule[],
    }));

    // Build final locked style guide
    const styleGuide: StyleGuideLocked = {
      id: crypto.randomUUID(),
      styleRunId,
      imageSetId: geminiAnalysis.imageSetId,
      geminiAnalysisId: geminiAnalysis.id,
      tokens,
      componentGuides,
      generalRules: rawResponse.generalRules as StyleRule[],
      density: rawResponse.density,
      contrast: rawResponse.contrast,
      iconStyle: rawResponse.iconStyle,
      focusStyle: rawResponse.focusStyle,
      references: rawResponse.references,
      assumptions: rawResponse.assumptions,
      lockedAt: new Date().toISOString(),
      tokensHash,
      refinedByModel: this.model,
    };

    return {
      styleGuide,
      latencyMs,
    };
  }

  /**
   * Health check - verify SDK is properly configured.
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Simple query to verify connectivity
      for await (const message of query({
        prompt: "Reply with exactly: OK",
        options: {
          allowedTools: [],
          model: this.model,
        },
      })) {
        if (message.type === "result" && message.subtype === "success") {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }
}

/**
 * Create a new Claude Agent SDK client.
 */
export function createClaudeAgentClient(
  options?: ClaudeAgentClientOptions
): ClaudeAgentClient {
  return new ClaudeAgentClient(options);
}
