import { z } from "zod";

const envSchema = z.object({
  REPLICATE_API_TOKEN: z.string().min(1, "REPLICATE_API_TOKEN is required"),
  GEMINI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  PORT: z.string().optional().default("3001"),
  NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function validateEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join(".")).join(", ");
    console.error(`Missing or invalid environment variables: ${missing}`);
    console.error("Please ensure REPLICATE_API_TOKEN is set in your environment.");

    // In development, allow starting without full config for testing
    if (process.env.NODE_ENV !== "production") {
      console.warn("Running in development mode with missing env vars.");
      cachedEnv = {
        REPLICATE_API_TOKEN: process.env.REPLICATE_API_TOKEN || "",
        GEMINI_API_KEY: process.env.GEMINI_API_KEY,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        PORT: process.env.PORT || "3001",
        NODE_ENV: "development",
      };
      return cachedEnv;
    }

    process.exit(1);
  }

  cachedEnv = result.data;
  return cachedEnv;
}

export function getEnv(): Env {
  if (!cachedEnv) {
    return validateEnv();
  }
  return cachedEnv;
}
