/**
 * Generates JSON Schema from Zod schemas.
 * Run with: pnpm generate-json-schema
 */

import { writeFileSync } from "node:fs";
import { zodToJsonSchema } from "zod-to-json-schema";
import { PipelineSessionSchema, schemas } from "../schema.js";

const jsonSchema = zodToJsonSchema(PipelineSessionSchema, {
  name: "PipelineSession",
  definitions: {
    ImageSet: schemas.ImageSetSchema,
    ImageEntry: schemas.ImageEntrySchema,
    ParsedElement: schemas.ParsedElementSchema,
    CropSpec: schemas.CropSpecSchema,
    CropArtifact: schemas.CropArtifactSchema,
    GeminiAnalysis: schemas.GeminiAnalysisSchema,
    ComponentCandidate: schemas.ComponentCandidateSchema,
    TokenCandidate: schemas.TokenCandidateSchema,
    CodegenPlan: schemas.CodegenPlanSchema,
    CodegenResult: schemas.CodegenResultSchema,
    BBox: schemas.BBoxSchema,
    Dimensions: schemas.DimensionsSchema,
  },
  $refStrategy: "root",
});

const output = JSON.stringify(jsonSchema, null, 2);

writeFileSync(new URL("../schema.json", import.meta.url), output);

console.log("Generated schema.json");
