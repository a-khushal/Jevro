-- AlterTable
ALTER TABLE "Agent"
ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Policy"
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SigningKey" (
  "id" TEXT NOT NULL,
  "kid" TEXT NOT NULL,
  "secret" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activatedAt" TIMESTAMP(3),
  "deactivatedAt" TIMESTAMP(3),
  CONSTRAINT "SigningKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevokedToken" (
  "id" TEXT NOT NULL,
  "jti" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "reason" TEXT,
  "revokedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RevokedToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Agent_tenantId_deletedAt_idx" ON "Agent"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "Policy_tenantId_deletedAt_idx" ON "Policy"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "ApprovalRequest_resolvedAt_idx" ON "ApprovalRequest"("resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SigningKey_kid_key" ON "SigningKey"("kid");

-- CreateIndex
CREATE INDEX "SigningKey_isActive_idx" ON "SigningKey"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "RevokedToken_jti_key" ON "RevokedToken"("jti");

-- CreateIndex
CREATE INDEX "RevokedToken_tenantId_idx" ON "RevokedToken"("tenantId");

-- CreateIndex
CREATE INDEX "RevokedToken_expiresAt_idx" ON "RevokedToken"("expiresAt");
