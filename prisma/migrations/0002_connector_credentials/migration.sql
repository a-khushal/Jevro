-- CreateTable
CREATE TABLE "ConnectorCredential" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "connector" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConnectorCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConnectorCredential_tenantId_connector_key" ON "ConnectorCredential"("tenantId", "connector");

-- CreateIndex
CREATE INDEX "ConnectorCredential_tenantId_idx" ON "ConnectorCredential"("tenantId");
