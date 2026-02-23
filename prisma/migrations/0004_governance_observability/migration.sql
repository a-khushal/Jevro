-- AlterTable
ALTER TABLE "Agent"
ADD COLUMN "principalType" TEXT NOT NULL DEFAULT 'agent';

-- AlterTable
ALTER TABLE "Policy"
ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN "dryRun" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "templateId" TEXT;

-- AlterTable
ALTER TABLE "ApprovalRequest"
ADD COLUMN "requiredApprovals" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "approvedBy" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "riskLevel" TEXT NOT NULL DEFAULT 'low';

-- CreateTable
CREATE TABLE "TenantConfig" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "tokenTtlSeconds" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TenantConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "connector" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "responseStatus" INTEGER NOT NULL,
  "responseBody" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Policy_tenantId_priority_idx" ON "Policy"("tenantId", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "TenantConfig_tenantId_key" ON "TenantConfig"("tenantId");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_tenantId_agentId_connector_action_idempotencyK_key" ON "IdempotencyRecord"("tenantId", "agentId", "connector", "action", "idempotencyKey");
