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
  /** Human-readable style guide markdown */
  styleGuideMd: string;
  /** Human-readable design documentation markdown */
  designMd: string;
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

const STYLE_GUIDE_MD_PROMPT = `You are a design system documentation expert. Generate a comprehensive, human-readable style guide markdown document from the locked design tokens.

The document should be structured as:

# Style Guide

## Overview
Brief description of the design system's overall aesthetic and purpose.

## Colors
Document each color token with:
- CSS variable name
- Hex value and visual swatch (use emoji or ASCII)
- Usage guidelines and when to use each color

## Typography
Document the type scale with:
- Font sizes, weights, line heights
- When to use each level (headings, body, captions, etc.)
- Example use cases

## Spacing
Document the spacing scale with:
- Values in pixels and rem
- Usage guidelines (padding vs margin vs gap)
- Common patterns

## Borders & Radius
Document border and radius tokens with usage guidelines.

## Shadows
Document shadow tokens with visual hierarchy guidance.

## Motion
Document animation/transition tokens with timing and easing guidance.

## Component Patterns
For each component type, document:
- Which tokens to use
- Sizing and padding specifications
- Do's and don'ts

Make it practical and actionable for developers implementing components.
Output ONLY the markdown content, no code blocks wrapping it.`;

const DESIGN_MD_PROMPT = `You are a UI/UX design documentation expert. Generate a comprehensive design philosophy and patterns document from the style analysis.

The document should be structured as:

# Design System Philosophy

## Aesthetic Overview
Describe the overall visual aesthetic, mood, and design language:
- Is it minimal, playful, corporate, modern, etc.?
- What emotions or feelings should the UI evoke?
- Key visual characteristics that define the look

## Visual Hierarchy
- How is hierarchy established (size, color, weight)?
- Content prioritization patterns
- Information density approach

## Interaction Patterns
- Common interaction behaviors
- Hover, focus, and active states
- Feedback mechanisms

## Layout Principles
- Grid and spacing philosophy
- Content organization patterns
- Responsive behavior guidelines

## Animation & Motion
- Animation philosophy (subtle vs. expressive)
- Timing and easing patterns
- When to use motion vs. static

## Accessibility
- Contrast requirements
- Focus state guidelines
- Interactive element sizing

## Do's and Don'ts
List clear guidelines:
### Do
- Specific things to follow

### Don't
- Specific things to avoid

## Grounding Instructions for AI
Instructions for AI tools (Claude, Gemini) when generating components:
- Key aesthetic principles to maintain
- Specific patterns to follow
- Common mistakes to avoid
- Reference tokens and their semantic meaning

Make this document useful for both human designers and AI code generation tools.
Output ONLY the markdown content, no code blocks wrapping it.`;

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
 *
 * SECURITY NOTE: API keys are stored only in instance memory and never
 * written to process.env to prevent key persistence across requests.
 */
export class ClaudeAgentClient {
  private model: string;
  private apiKey: string | undefined;

  constructor(options: ClaudeAgentClientOptions = {}) {
    this.model = options.model || CLAUDE_MODEL;
    // Store API key in instance memory only - never mutate process.env
    this.apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
  }

  /**
   * Ensure the Claude Agent SDK has access to the API key.
   * This temporarily sets the env var only if needed, then cleans up.
   */
  private async withApiKey<T>(fn: () => Promise<T>): Promise<T> {
    const hadEnvKey = !!process.env.ANTHROPIC_API_KEY;
    const originalKey = process.env.ANTHROPIC_API_KEY;

    try {
      // Only set if we have a key and env doesn't already have one
      if (this.apiKey && !hadEnvKey) {
        process.env.ANTHROPIC_API_KEY = this.apiKey;
      }
      return await fn();
    } finally {
      // Restore original state
      if (!hadEnvKey && this.apiKey) {
        delete process.env.ANTHROPIC_API_KEY;
      } else if (hadEnvKey && originalKey) {
        process.env.ANTHROPIC_API_KEY = originalKey;
      }
    }
  }

  /**
   * Refine Gemini style analysis into locked tokens.
   */
  async refineStyle(input: StyleRefinementInput): Promise<StyleRefinementResult> {
    return this.withApiKey(async () => {
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

    // Generate human-readable documentation
    console.log("[ClaudeAgent] Generating style-guide.md...");
    const styleGuideMd = await this.generateDocumentation(
      STYLE_GUIDE_MD_PROMPT,
      styleGuide,
      geminiAnalysis
    );

    console.log("[ClaudeAgent] Generating design.md...");
    const designMd = await this.generateDocumentation(
      DESIGN_MD_PROMPT,
      styleGuide,
      geminiAnalysis
    );

      const totalLatencyMs = Date.now() - startTime;

      return {
        styleGuide,
        styleGuideMd,
        designMd,
        latencyMs: totalLatencyMs,
      };
    });
  }

  /**
   * Generate markdown documentation from style guide and analysis.
   */
  private async generateDocumentation(
    systemPrompt: string,
    styleGuide: StyleGuideLocked,
    geminiAnalysis: StyleAnalysisGemini
  ): Promise<string> {
    return this.withApiKey(async () => {
      const dataPrompt = `
## Locked Style Guide (JSON)
\`\`\`json
${JSON.stringify(styleGuide, null, 2)}
\`\`\`

## Original Gemini Analysis (JSON)
\`\`\`json
${JSON.stringify(geminiAnalysis, null, 2)}
\`\`\`

Generate the documentation:`;

      let responseText = "";

      for await (const message of query({
        prompt: `${systemPrompt}\n\n${dataPrompt}`,
        options: {
          allowedTools: [],
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

      // Clean up any accidental code block wrapping
      let cleanedResponse = responseText.trim();
      if (cleanedResponse.startsWith("```markdown")) {
        cleanedResponse = cleanedResponse.slice(11);
      } else if (cleanedResponse.startsWith("```md")) {
        cleanedResponse = cleanedResponse.slice(5);
      } else if (cleanedResponse.startsWith("```")) {
        cleanedResponse = cleanedResponse.slice(3);
      }
      if (cleanedResponse.endsWith("```")) {
        cleanedResponse = cleanedResponse.slice(0, -3);
      }

      return cleanedResponse.trim();
    });
  }

  /**
   * Health check - verify SDK is properly configured.
   */
  async healthCheck(): Promise<boolean> {
    return this.withApiKey(async () => {
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
    });
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
