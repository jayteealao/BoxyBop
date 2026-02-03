/**
 * Validation Module.
 *
 * Scripts for validating generated UI packages:
 * - validate-registry: Check file references and compilation
 * - validate-tokens: Check token lock compliance
 */

export { validateRegistryPackage } from "./validate-registry.js";
export { validateTokens } from "./validate-tokens.js";
