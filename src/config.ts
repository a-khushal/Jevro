import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  PORT: z.coerce.number().int().positive().default(8080),
  TOKEN_SECRET: z.string().min(16, "TOKEN_SECRET must be at least 16 characters"),
  TOKEN_DEFAULT_KID: z.string().min(1).default("local-dev-kid-1"),
  TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:5173"),
  JSON_BODY_LIMIT: z.string().default("100kb"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(120),
  TENANT_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  TENANT_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(240),
  AGENT_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  AGENT_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(120),
  CONNECTOR_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  CONNECTOR_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(180),
  TENANT_DAILY_QUOTA: z.coerce.number().int().positive().default(10000),
  TENANT_QUOTA_OVERAGE_BEHAVIOR: z.enum(["block", "allow_with_audit"]).default("block"),
  CONNECTOR_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  CONNECTOR_RETRY_COUNT: z.coerce.number().int().min(0).default(2),
  CONNECTOR_RETRY_BACKOFF_MS: z.coerce.number().int().positive().default(250),
  CIRCUIT_BREAKER_FAILURE_THRESHOLD: z.coerce.number().int().positive().default(5),
  CIRCUIT_BREAKER_OPEN_MS: z.coerce.number().int().positive().default(30000),
  GITHUB_API_BASE_URL: z.string().url().default("https://api.github.com"),
  JIRA_API_BASE_URL: z.string().url().default("https://your-domain.atlassian.net"),
  SLACK_API_BASE_URL: z.string().url().default("https://slack.com/api"),
  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_SIGNING_SECRET: z.string().optional(),
  SLACK_APPROVAL_CHANNEL: z.string().optional(),
  APPROVAL_EXPIRATION_SWEEP_MS: z.coerce.number().int().positive().default(60000),
  RETENTION_SWEEP_MS: z.coerce.number().int().positive().default(300000),
  AUDIT_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  APPROVAL_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  SECURITY_ALERT_WINDOW_MS: z.coerce.number().int().positive().default(300000),
  SECURITY_ALERT_THRESHOLD: z.coerce.number().int().positive().default(10),
  ADMIN_UI_USERNAME: z.string().min(1).default("admin"),
  ADMIN_UI_PASSWORD: z.string().min(8).default("change-me-admin")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

const env = parsed.data;

export const PORT = env.PORT;
export const TOKEN_SECRET = env.TOKEN_SECRET;
export const TOKEN_DEFAULT_KID = env.TOKEN_DEFAULT_KID;
export const TOKEN_TTL_SECONDS = env.TOKEN_TTL_SECONDS;
export const JSON_BODY_LIMIT = env.JSON_BODY_LIMIT;
export const RATE_LIMIT_WINDOW_MS = env.RATE_LIMIT_WINDOW_MS;
export const RATE_LIMIT_MAX_REQUESTS = env.RATE_LIMIT_MAX_REQUESTS;
export const TENANT_RATE_LIMIT_WINDOW_MS = env.TENANT_RATE_LIMIT_WINDOW_MS;
export const TENANT_RATE_LIMIT_MAX_REQUESTS = env.TENANT_RATE_LIMIT_MAX_REQUESTS;
export const AGENT_RATE_LIMIT_WINDOW_MS = env.AGENT_RATE_LIMIT_WINDOW_MS;
export const AGENT_RATE_LIMIT_MAX_REQUESTS = env.AGENT_RATE_LIMIT_MAX_REQUESTS;
export const CONNECTOR_RATE_LIMIT_WINDOW_MS = env.CONNECTOR_RATE_LIMIT_WINDOW_MS;
export const CONNECTOR_RATE_LIMIT_MAX_REQUESTS = env.CONNECTOR_RATE_LIMIT_MAX_REQUESTS;
export const TENANT_DAILY_QUOTA = env.TENANT_DAILY_QUOTA;
export const TENANT_QUOTA_OVERAGE_BEHAVIOR = env.TENANT_QUOTA_OVERAGE_BEHAVIOR;
export const CONNECTOR_TIMEOUT_MS = env.CONNECTOR_TIMEOUT_MS;
export const CONNECTOR_RETRY_COUNT = env.CONNECTOR_RETRY_COUNT;
export const CONNECTOR_RETRY_BACKOFF_MS = env.CONNECTOR_RETRY_BACKOFF_MS;
export const CIRCUIT_BREAKER_FAILURE_THRESHOLD = env.CIRCUIT_BREAKER_FAILURE_THRESHOLD;
export const CIRCUIT_BREAKER_OPEN_MS = env.CIRCUIT_BREAKER_OPEN_MS;
export const GITHUB_API_BASE_URL = env.GITHUB_API_BASE_URL;
export const JIRA_API_BASE_URL = env.JIRA_API_BASE_URL;
export const SLACK_API_BASE_URL = env.SLACK_API_BASE_URL;
export const CORS_ORIGINS = env.CORS_ORIGINS.split(",").map((value) => value.trim()).filter(Boolean);
export const SLACK_BOT_TOKEN = env.SLACK_BOT_TOKEN;
export const SLACK_SIGNING_SECRET = env.SLACK_SIGNING_SECRET;
export const SLACK_APPROVAL_CHANNEL = env.SLACK_APPROVAL_CHANNEL;
export const APPROVAL_EXPIRATION_SWEEP_MS = env.APPROVAL_EXPIRATION_SWEEP_MS;
export const RETENTION_SWEEP_MS = env.RETENTION_SWEEP_MS;
export const AUDIT_RETENTION_DAYS = env.AUDIT_RETENTION_DAYS;
export const APPROVAL_RETENTION_DAYS = env.APPROVAL_RETENTION_DAYS;
export const SECURITY_ALERT_WINDOW_MS = env.SECURITY_ALERT_WINDOW_MS;
export const SECURITY_ALERT_THRESHOLD = env.SECURITY_ALERT_THRESHOLD;
export const ADMIN_UI_USERNAME = env.ADMIN_UI_USERNAME;
export const ADMIN_UI_PASSWORD = env.ADMIN_UI_PASSWORD;
