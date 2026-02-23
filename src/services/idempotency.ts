import { createHash } from "crypto";
import { IDEMPOTENCY_TTL_SECONDS } from "../config";
import { getIdempotencyRecord, upsertIdempotencyRecord } from "../db";
import { AppError } from "../errors";

type IdempotencyInput = {
  tenantId: string;
  agentId: string;
  connector: string;
  action: string;
  idempotencyKey: string;
  requestBody: Record<string, unknown>;
};

function hashRequestBody(body: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(body)).digest("hex");
}

export async function getIdempotentResponse(input: IdempotencyInput): Promise<{
  status: number;
  body: Record<string, unknown>;
} | null> {
  const record = await getIdempotencyRecord(input);
  if (!record) {
    return null;
  }

  if (record.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  const nextHash = hashRequestBody(input.requestBody);
  if (record.requestHash !== nextHash) {
    throw new AppError(409, "IDEMPOTENCY_KEY_CONFLICT", "Idempotency key already used with different payload");
  }

  return {
    status: record.responseStatus,
    body: record.responseBody as Record<string, unknown>
  };
}

export async function saveIdempotentResponse(
  input: IdempotencyInput,
  output: { status: number; body: Record<string, unknown> }
): Promise<void> {
  const requestHash = hashRequestBody(input.requestBody);

  await upsertIdempotencyRecord({
    ...input,
    requestHash,
    responseStatus: output.status,
    responseBody: output.body,
    expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_SECONDS * 1000)
  });
}
