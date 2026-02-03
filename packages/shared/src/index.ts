/**
 * @boxybop/shared
 *
 * Shared utilities and clients for BoxyBop pipeline.
 */

export {
  OmniParserClient,
  createOmniParserClient,
  OmniParserInputSchema,
  OmniParserBBoxSchema,
  OmniParserRawElementSchema,
  OmniParserElementSchema,
  OmniParserResponseSchema,
  type OmniParserInput,
  type OmniParserBBox,
  type OmniParserElement,
  type OmniParserResponse,
  type OmniParserClientOptions,
  type ParseOptions,
} from "./omniparserClient.js";

export {
  GeminiClient,
  createGeminiClient,
  type GeminiClientOptions,
  type StyleAnalysisImage,
  type GeminiStyleAnalysisResponse,
} from "./geminiClient.js";

export {
  ClaudeAgentClient,
  createClaudeAgentClient,
  type ClaudeAgentClientOptions,
  type StyleRefinementInput,
  type StyleRefinementResult,
} from "./claudeAgentClient.js";
