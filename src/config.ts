import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  PORT: z.coerce.number().int().positive().default(8080),
  TOKEN_SECRET: z.string().min(16, "TOKEN_SECRET must be at least 16 characters"),
  TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:5173"),
  JSON_BODY_LIMIT: z.string().default("100kb"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(120)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

const env = parsed.data;

export const PORT = env.PORT;
export const TOKEN_SECRET = env.TOKEN_SECRET;
export const TOKEN_TTL_SECONDS = env.TOKEN_TTL_SECONDS;
export const JSON_BODY_LIMIT = env.JSON_BODY_LIMIT;
export const RATE_LIMIT_WINDOW_MS = env.RATE_LIMIT_WINDOW_MS;
export const RATE_LIMIT_MAX_REQUESTS = env.RATE_LIMIT_MAX_REQUESTS;
export const CORS_ORIGINS = env.CORS_ORIGINS.split(",").map((value) => value.trim()).filter(Boolean);
