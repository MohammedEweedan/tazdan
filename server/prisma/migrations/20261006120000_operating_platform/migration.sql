-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('SUPER_ADMIN', 'EXECUTIVE', 'OPERATIONS', 'FINANCE', 'TREASURY', 'COMPLIANCE', 'AML_ANALYST', 'FRAUD_ANALYST', 'SUPPORT', 'SECURITY', 'TECH_OPS', 'AUDITOR');

-- CreateEnum
CREATE TYPE "ControlScope" AS ENUM ('FEATURE', 'CORRIDOR', 'PROVIDER', 'USER', 'WALLET');

-- CreateEnum
CREATE TYPE "ProviderCategory" AS ENUM ('BANK', 'PSP', 'PAYOUT', 'REMITTANCE', 'KYC', 'SANCTIONS', 'AML', 'CARD_ISSUER', 'VASP', 'CUSTODY', 'BLOCKCHAIN', 'FX', 'NOTIFICATION', 'ONRAMP', 'OFFRAMP');

-- CreateEnum
CREATE TYPE "ProviderMode" AS ENUM ('PRODUCTION', 'SANDBOX', 'MOCK');

-- CreateEnum
CREATE TYPE "ProviderStatus" AS ENUM ('ENABLED', 'DISABLED', 'MAINTENANCE', 'NOT_ACTIVATED');

-- CreateEnum
CREATE TYPE "CorridorStatus" AS ENUM ('LIVE', 'SANDBOX_ONLY', 'PAUSED', 'DISABLED');

-- CreateEnum
CREATE TYPE "RemittanceDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateEnum
CREATE TYPE "RemittanceState" AS ENUM ('CREATED', 'QUOTED', 'COMPLIANCE_PENDING', 'APPROVED', 'FUNDING_PENDING', 'FUNDED', 'ROUTING', 'ROUTED', 'SETTLEMENT_PENDING', 'SETTLED', 'PAYOUT_PENDING', 'PAID', 'RECONCILIATION_PENDING', 'RECONCILED', 'COMPLETED', 'EXPIRED', 'REJECTED', 'CANCELLED', 'FAILED', 'MANUAL_REVIEW', 'REFUND_PENDING', 'REFUNDED', 'DISPUTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LedgerAccountType" ADD VALUE 'REMITTANCE_CLEARING';
ALTER TYPE "LedgerAccountType" ADD VALUE 'PARTNER_SETTLEMENT';
ALTER TYPE "LedgerAccountType" ADD VALUE 'TREASURY';
ALTER TYPE "LedgerAccountType" ADD VALUE 'SUSPENSE';
ALTER TYPE "LedgerAccountType" ADD VALUE 'ADJUSTMENT';

-- AlterTable
ALTER TABLE "APIKey" ADD COLUMN     "businessId" TEXT,
ADD COLUMN     "last4" TEXT,
ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "usageCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "BusinessProfile" ADD COLUMN     "approvalThresholdUsd" DECIMAL(20,2),
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "tradingName" TEXT;

-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "externalCardId" TEXT,
ADD COLUMN     "issuerName" TEXT;

-- AlterTable
ALTER TABLE "ExchangeRate" ADD COLUMN     "overrideExpiresAt" TIMESTAMP(3),
ADD COLUMN     "overrideReason" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "staffRoles" "StaffRole"[] DEFAULT ARRAY[]::"StaffRole"[];

-- CreateTable
CREATE TABLE "ControlSwitch" (
    "id" TEXT NOT NULL,
    "scope" "ControlScope" NOT NULL,
    "key" TEXT NOT NULL,
    "blocked" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT NOT NULL,
    "setById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ControlSwitch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControlSwitchEvent" (
    "id" TEXT NOT NULL,
    "scope" "ControlScope" NOT NULL,
    "key" TEXT NOT NULL,
    "previousBlocked" BOOLEAN,
    "newBlocked" BOOLEAN NOT NULL,
    "reason" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ControlSwitchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StateTransition" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fromState" TEXT,
    "toState" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "reason" TEXT,
    "provider" TEXT,
    "providerResponse" JSONB,
    "riskDecisionId" TEXT,
    "ledgerGroupIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StateTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'LOW',
    "userId" TEXT,
    "ipAddress" TEXT,
    "path" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ProviderCategory" NOT NULL,
    "mode" "ProviderMode" NOT NULL,
    "status" "ProviderStatus" NOT NULL DEFAULT 'NOT_ACTIVATED',
    "countries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "currencies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "config" JSONB,
    "lastHealthAt" TIMESTAMP(3),
    "lastHealthOk" BOOLEAN,
    "lastLatencyMs" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderCall" (
    "id" TEXT NOT NULL,
    "providerCode" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "correlationId" TEXT,
    "success" BOOLEAN NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "errorCode" TEXT,
    "request" JSONB,
    "response" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemittanceCorridor" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceCountry" TEXT NOT NULL,
    "destCountry" TEXT NOT NULL,
    "sourceCurrency" "Currency" NOT NULL,
    "destCurrency" "Currency" NOT NULL,
    "direction" "RemittanceDirection" NOT NULL,
    "status" "CorridorStatus" NOT NULL DEFAULT 'SANDBOX_ONLY',
    "minAmount" DECIMAL(20,8) NOT NULL,
    "maxAmount" DECIMAL(20,8) NOT NULL,
    "dailyLimitPerCustomer" DECIMAL(20,8),
    "monthlyLimitPerCustomer" DECIMAL(20,8),
    "feeFixed" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "feePercent" DECIMAL(8,6) NOT NULL DEFAULT 0,
    "spreadPercent" DECIMAL(8,6) NOT NULL DEFAULT 0,
    "quoteTtlSeconds" INTEGER NOT NULL DEFAULT 300,
    "rateFloor" DECIMAL(20,8),
    "rateCeiling" DECIMAL(20,8),
    "tierSpreadDiscounts" JSONB,
    "sourceOfFundsThreshold" DECIMAL(20,8),
    "allowedPurposes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "payoutMethods" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RemittanceCorridor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemittanceBeneficiary" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "relationship" TEXT,
    "country" TEXT NOT NULL,
    "currency" "Currency" NOT NULL,
    "payoutMethod" TEXT NOT NULL,
    "tazdanUserId" TEXT,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "iban" TEXT,
    "sortCode" TEXT,
    "swift" TEXT,
    "mobileWallet" TEXT,
    "city" TEXT,
    "addressLine" TEXT,
    "screeningStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "screenedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RemittanceBeneficiary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemittanceQuote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "corridorId" TEXT NOT NULL,
    "sourceCurrency" "Currency" NOT NULL,
    "destCurrency" "Currency" NOT NULL,
    "sendAmount" DECIMAL(20,8) NOT NULL,
    "feeAmount" DECIMAL(20,8) NOT NULL,
    "totalDebit" DECIMAL(20,8) NOT NULL,
    "baseRate" DECIMAL(20,8) NOT NULL,
    "customerRate" DECIMAL(20,8) NOT NULL,
    "spreadPercent" DECIMAL(8,6) NOT NULL,
    "receiveAmount" DECIMAL(20,8) NOT NULL,
    "rateSource" TEXT NOT NULL,
    "providerCode" TEXT,
    "routeScore" DECIMAL(10,4),
    "deliveryMins" INTEGER,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemittanceQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemittanceTransfer" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "corridorId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "beneficiaryId" TEXT NOT NULL,
    "sourceCurrency" "Currency" NOT NULL,
    "destCurrency" "Currency" NOT NULL,
    "sendAmount" DECIMAL(20,8) NOT NULL,
    "feeAmount" DECIMAL(20,8) NOT NULL,
    "totalDebit" DECIMAL(20,8) NOT NULL,
    "baseRate" DECIMAL(20,8) NOT NULL,
    "customerRate" DECIMAL(20,8) NOT NULL,
    "receiveAmount" DECIMAL(20,8) NOT NULL,
    "purpose" TEXT NOT NULL,
    "sourceOfFunds" TEXT,
    "state" "RemittanceState" NOT NULL DEFAULT 'CREATED',
    "riskScore" INTEGER,
    "riskOutcome" TEXT,
    "providerCode" TEXT,
    "providerRef" TEXT,
    "idempotencyKey" TEXT,
    "correlationId" TEXT NOT NULL,
    "failureReason" TEXT,
    "fundedAt" TIMESTAMP(3),
    "routedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RemittanceTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemittanceRoute" (
    "id" TEXT NOT NULL,
    "transferId" TEXT,
    "quoteId" TEXT,
    "providerCode" TEXT NOT NULL,
    "score" DECIMAL(10,4) NOT NULL,
    "rank" INTEGER NOT NULL,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "eligible" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT NOT NULL,
    "estimatedCost" DECIMAL(20,8) NOT NULL,
    "estimatedDeliveryMins" INTEGER NOT NULL,
    "requiredLiquidity" DECIMAL(20,8) NOT NULL,
    "liquidityCurrency" "Currency" NOT NULL,
    "factors" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemittanceRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemittancePayout" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "providerCode" TEXT NOT NULL,
    "providerRef" TEXT,
    "amount" DECIMAL(20,8) NOT NULL,
    "currency" "Currency" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "failureReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RemittancePayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemittanceSettlement" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "providerCode" TEXT NOT NULL,
    "currency" "Currency" NOT NULL,
    "amount" DECIMAL(20,8) NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "transferIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dueAt" TIMESTAMP(3) NOT NULL,
    "instructedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RemittanceSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemittanceRefund" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "amount" DECIMAL(20,8) NOT NULL,
    "currency" "Currency" NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "ledgerGroupId" TEXT,
    "requestedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "RemittanceRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreasuryPool" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" "Currency" NOT NULL,
    "entity" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "providerCode" TEXT,
    "corridorCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fundClass" TEXT NOT NULL DEFAULT 'SETTLEMENT',
    "target" DECIMAL(20,8) NOT NULL,
    "minimum" DECIMAL(20,8) NOT NULL,
    "maxExposure" DECIMAL(20,8) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreasuryPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreasuryMovement" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(20,8) NOT NULL,
    "reference" TEXT,
    "transferId" TEXT,
    "actorId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreasuryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskRule" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "action" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 20,
    "params" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskDecision" (
    "id" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "userId" TEXT,
    "outcome" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "triggeredRules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "signals" JSONB NOT NULL,
    "explanation" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "decidedBy" TEXT NOT NULL DEFAULT 'SYSTEM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'LOW',
    "score" INTEGER NOT NULL DEFAULT 0,
    "subjectType" TEXT,
    "subjectId" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceCase" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "subjectUserId" TEXT,
    "subjectBusinessId" TEXT,
    "subjectType" TEXT,
    "subjectId" TEXT,
    "riskDecisionId" TEXT,
    "assignedToId" TEXT,
    "openedById" TEXT,
    "resolution" TEXT,
    "slaDueAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseNote" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorType" TEXT NOT NULL DEFAULT 'STAFF',
    "kind" TEXT NOT NULL DEFAULT 'NOTE',
    "body" TEXT NOT NULL,
    "attachments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchlistEntry" (
    "id" TEXT NOT NULL,
    "listName" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "name" TEXT,
    "normalizedName" TEXT,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "country" TEXT,
    "dateOfBirth" TEXT,
    "walletAddress" TEXT,
    "identifier" TEXT,
    "source" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreeningResult" (
    "id" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "userId" TEXT,
    "status" TEXT NOT NULL,
    "matches" JSONB NOT NULL,
    "listsChecked" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "screenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "ScreeningResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationRun" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "providerCode" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "totals" JSONB,
    "startedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ReconciliationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationItem" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "internalType" TEXT,
    "internalId" TEXT,
    "externalRef" TEXT,
    "internalAmount" DECIMAL(38,18),
    "externalAmount" DECIMAL(38,18),
    "currency" TEXT,
    "details" JSONB,
    "resolution" TEXT NOT NULL DEFAULT 'OPEN',
    "resolvedById" TEXT,
    "resolutionNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconciliationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessTeamMember" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "invitedById" TEXT,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedAt" TIMESTAMP(3),

    CONSTRAINT "BusinessTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessPayoutBatch" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "currency" "Currency" NOT NULL,
    "totalAmount" DECIMAL(20,8) NOT NULL,
    "totalFee" DECIMAL(20,8) NOT NULL,
    "count" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessPayoutBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessPayout" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "batchId" TEXT,
    "reference" TEXT NOT NULL,
    "recipientUserId" TEXT,
    "recipientHandle" TEXT,
    "recipientEmail" TEXT,
    "amount" DECIMAL(20,8) NOT NULL,
    "currency" "Currency" NOT NULL,
    "feeAmount" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(20,8) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "failureReason" TEXT,
    "ledgerGroupId" TEXT,
    "createdById" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessWebhookEndpoint" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT[],
    "secret" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessWebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessWebhookDelivery" (
    "id" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "responseStatus" INTEGER,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessWebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKeyUsage" (
    "id" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ApiKeyUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemMetricSample" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemMetricSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiInteraction" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "operatorId" TEXT,
    "model" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "references" JSONB,
    "output" JSONB NOT NULL,
    "confidence" DECIMAL(5,4),
    "recommendedAction" TEXT,
    "approvalStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "outcome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "subjectType" TEXT,
    "subjectId" TEXT,
    "requestedById" TEXT NOT NULL,
    "decidedById" TEXT,
    "decisionNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "result" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ControlSwitch_blocked_idx" ON "ControlSwitch"("blocked");

-- CreateIndex
CREATE UNIQUE INDEX "ControlSwitch_scope_key_key" ON "ControlSwitch"("scope", "key");

-- CreateIndex
CREATE INDEX "ControlSwitchEvent_scope_key_createdAt_idx" ON "ControlSwitchEvent"("scope", "key", "createdAt");

-- CreateIndex
CREATE INDEX "ControlSwitchEvent_createdAt_idx" ON "ControlSwitchEvent"("createdAt");

-- CreateIndex
CREATE INDEX "StateTransition_entityType_entityId_createdAt_idx" ON "StateTransition"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "StateTransition_correlationId_idx" ON "StateTransition"("correlationId");

-- CreateIndex
CREATE INDEX "StateTransition_createdAt_idx" ON "StateTransition"("createdAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_type_createdAt_idx" ON "SecurityEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_userId_idx" ON "SecurityEvent"("userId");

-- CreateIndex
CREATE INDEX "SecurityEvent_createdAt_idx" ON "SecurityEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_code_key" ON "Provider"("code");

-- CreateIndex
CREATE INDEX "Provider_category_idx" ON "Provider"("category");

-- CreateIndex
CREATE INDEX "Provider_status_idx" ON "Provider"("status");

-- CreateIndex
CREATE INDEX "ProviderCall_providerCode_createdAt_idx" ON "ProviderCall"("providerCode", "createdAt");

-- CreateIndex
CREATE INDEX "ProviderCall_entityType_entityId_idx" ON "ProviderCall"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "RemittanceCorridor_code_key" ON "RemittanceCorridor"("code");

-- CreateIndex
CREATE INDEX "RemittanceBeneficiary_userId_idx" ON "RemittanceBeneficiary"("userId");

-- CreateIndex
CREATE INDEX "RemittanceBeneficiary_screeningStatus_idx" ON "RemittanceBeneficiary"("screeningStatus");

-- CreateIndex
CREATE INDEX "RemittanceQuote_userId_createdAt_idx" ON "RemittanceQuote"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RemittanceQuote_corridorId_createdAt_idx" ON "RemittanceQuote"("corridorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RemittanceTransfer_reference_key" ON "RemittanceTransfer"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "RemittanceTransfer_quoteId_key" ON "RemittanceTransfer"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "RemittanceTransfer_idempotencyKey_key" ON "RemittanceTransfer"("idempotencyKey");

-- CreateIndex
CREATE INDEX "RemittanceTransfer_userId_createdAt_idx" ON "RemittanceTransfer"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RemittanceTransfer_state_idx" ON "RemittanceTransfer"("state");

-- CreateIndex
CREATE INDEX "RemittanceTransfer_corridorId_createdAt_idx" ON "RemittanceTransfer"("corridorId", "createdAt");

-- CreateIndex
CREATE INDEX "RemittanceTransfer_providerCode_idx" ON "RemittanceTransfer"("providerCode");

-- CreateIndex
CREATE INDEX "RemittanceTransfer_providerRef_idx" ON "RemittanceTransfer"("providerRef");

-- CreateIndex
CREATE INDEX "RemittanceRoute_transferId_idx" ON "RemittanceRoute"("transferId");

-- CreateIndex
CREATE INDEX "RemittanceRoute_quoteId_idx" ON "RemittanceRoute"("quoteId");

-- CreateIndex
CREATE INDEX "RemittancePayout_providerCode_status_idx" ON "RemittancePayout"("providerCode", "status");

-- CreateIndex
CREATE INDEX "RemittancePayout_providerRef_idx" ON "RemittancePayout"("providerRef");

-- CreateIndex
CREATE UNIQUE INDEX "RemittancePayout_transferId_attempt_key" ON "RemittancePayout"("transferId", "attempt");

-- CreateIndex
CREATE UNIQUE INDEX "RemittanceSettlement_reference_key" ON "RemittanceSettlement"("reference");

-- CreateIndex
CREATE INDEX "RemittanceSettlement_providerCode_status_idx" ON "RemittanceSettlement"("providerCode", "status");

-- CreateIndex
CREATE INDEX "RemittanceSettlement_dueAt_idx" ON "RemittanceSettlement"("dueAt");

-- CreateIndex
CREATE INDEX "RemittanceRefund_transferId_idx" ON "RemittanceRefund"("transferId");

-- CreateIndex
CREATE UNIQUE INDEX "TreasuryPool_code_key" ON "TreasuryPool"("code");

-- CreateIndex
CREATE INDEX "TreasuryMovement_poolId_createdAt_idx" ON "TreasuryMovement"("poolId", "createdAt");

-- CreateIndex
CREATE INDEX "TreasuryMovement_transferId_idx" ON "TreasuryMovement"("transferId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskRule_code_key" ON "RiskRule"("code");

-- CreateIndex
CREATE INDEX "RiskDecision_subjectType_subjectId_idx" ON "RiskDecision"("subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "RiskDecision_userId_createdAt_idx" ON "RiskDecision"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RiskDecision_outcome_createdAt_idx" ON "RiskDecision"("outcome", "createdAt");

-- CreateIndex
CREATE INDEX "RiskEvent_userId_createdAt_idx" ON "RiskEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RiskEvent_type_createdAt_idx" ON "RiskEvent"("type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceCase_reference_key" ON "ComplianceCase"("reference");

-- CreateIndex
CREATE INDEX "ComplianceCase_status_priority_idx" ON "ComplianceCase"("status", "priority");

-- CreateIndex
CREATE INDEX "ComplianceCase_type_status_idx" ON "ComplianceCase"("type", "status");

-- CreateIndex
CREATE INDEX "ComplianceCase_subjectUserId_idx" ON "ComplianceCase"("subjectUserId");

-- CreateIndex
CREATE INDEX "ComplianceCase_assignedToId_idx" ON "ComplianceCase"("assignedToId");

-- CreateIndex
CREATE INDEX "CaseNote_caseId_createdAt_idx" ON "CaseNote"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "WatchlistEntry_listName_idx" ON "WatchlistEntry"("listName");

-- CreateIndex
CREATE INDEX "WatchlistEntry_normalizedName_idx" ON "WatchlistEntry"("normalizedName");

-- CreateIndex
CREATE INDEX "WatchlistEntry_walletAddress_idx" ON "WatchlistEntry"("walletAddress");

-- CreateIndex
CREATE INDEX "WatchlistEntry_entityType_country_idx" ON "WatchlistEntry"("entityType", "country");

-- CreateIndex
CREATE INDEX "ScreeningResult_subjectType_subjectId_idx" ON "ScreeningResult"("subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "ScreeningResult_status_idx" ON "ScreeningResult"("status");

-- CreateIndex
CREATE INDEX "ReconciliationRun_source_createdAt_idx" ON "ReconciliationRun"("source", "createdAt");

-- CreateIndex
CREATE INDEX "ReconciliationItem_runId_status_idx" ON "ReconciliationItem"("runId", "status");

-- CreateIndex
CREATE INDEX "ReconciliationItem_status_resolution_idx" ON "ReconciliationItem"("status", "resolution");

-- CreateIndex
CREATE INDEX "ReconciliationItem_internalType_internalId_idx" ON "ReconciliationItem"("internalType", "internalId");

-- CreateIndex
CREATE INDEX "BusinessTeamMember_userId_idx" ON "BusinessTeamMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessTeamMember_businessId_email_key" ON "BusinessTeamMember"("businessId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessPayoutBatch_reference_key" ON "BusinessPayoutBatch"("reference");

-- CreateIndex
CREATE INDEX "BusinessPayoutBatch_businessId_createdAt_idx" ON "BusinessPayoutBatch"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "BusinessPayoutBatch_status_idx" ON "BusinessPayoutBatch"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessPayout_reference_key" ON "BusinessPayout"("reference");

-- CreateIndex
CREATE INDEX "BusinessPayout_businessId_createdAt_idx" ON "BusinessPayout"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "BusinessPayout_batchId_idx" ON "BusinessPayout"("batchId");

-- CreateIndex
CREATE INDEX "BusinessPayout_status_idx" ON "BusinessPayout"("status");

-- CreateIndex
CREATE INDEX "BusinessWebhookEndpoint_businessId_idx" ON "BusinessWebhookEndpoint"("businessId");

-- CreateIndex
CREATE INDEX "BusinessWebhookDelivery_status_nextAttemptAt_idx" ON "BusinessWebhookDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "BusinessWebhookDelivery_endpointId_createdAt_idx" ON "BusinessWebhookDelivery"("endpointId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKeyUsage_keyId_day_key" ON "ApiKeyUsage"("keyId", "day");

-- CreateIndex
CREATE INDEX "SystemMetricSample_kind_createdAt_idx" ON "SystemMetricSample"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "AiInteraction_kind_createdAt_idx" ON "AiInteraction"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "AiInteraction_operatorId_createdAt_idx" ON "AiInteraction"("operatorId", "createdAt");

-- CreateIndex
CREATE INDEX "AiInteraction_approvalStatus_idx" ON "AiInteraction"("approvalStatus");

-- CreateIndex
CREATE INDEX "ApprovalRequest_status_type_idx" ON "ApprovalRequest"("status", "type");

-- CreateIndex
CREATE INDEX "ApprovalRequest_requestedById_idx" ON "ApprovalRequest"("requestedById");

-- CreateIndex
CREATE INDEX "ApprovalRequest_subjectType_subjectId_idx" ON "ApprovalRequest"("subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "APIKey_businessId_idx" ON "APIKey"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Card_externalCardId_key" ON "Card"("externalCardId");

-- AddForeignKey
ALTER TABLE "APIKey" ADD CONSTRAINT "APIKey_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemittanceBeneficiary" ADD CONSTRAINT "RemittanceBeneficiary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemittanceQuote" ADD CONSTRAINT "RemittanceQuote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemittanceQuote" ADD CONSTRAINT "RemittanceQuote_corridorId_fkey" FOREIGN KEY ("corridorId") REFERENCES "RemittanceCorridor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemittanceTransfer" ADD CONSTRAINT "RemittanceTransfer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemittanceTransfer" ADD CONSTRAINT "RemittanceTransfer_corridorId_fkey" FOREIGN KEY ("corridorId") REFERENCES "RemittanceCorridor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemittanceTransfer" ADD CONSTRAINT "RemittanceTransfer_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "RemittanceQuote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemittanceTransfer" ADD CONSTRAINT "RemittanceTransfer_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "RemittanceBeneficiary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemittanceRoute" ADD CONSTRAINT "RemittanceRoute_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "RemittanceTransfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemittancePayout" ADD CONSTRAINT "RemittancePayout_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "RemittanceTransfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemittanceRefund" ADD CONSTRAINT "RemittanceRefund_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "RemittanceTransfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryMovement" ADD CONSTRAINT "TreasuryMovement_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "TreasuryPool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseNote" ADD CONSTRAINT "CaseNote_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ComplianceCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationItem" ADD CONSTRAINT "ReconciliationItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ReconciliationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessTeamMember" ADD CONSTRAINT "BusinessTeamMember_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessTeamMember" ADD CONSTRAINT "BusinessTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessPayoutBatch" ADD CONSTRAINT "BusinessPayoutBatch_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessPayout" ADD CONSTRAINT "BusinessPayout_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessPayout" ADD CONSTRAINT "BusinessPayout_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "BusinessPayoutBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessWebhookEndpoint" ADD CONSTRAINT "BusinessWebhookEndpoint_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessWebhookDelivery" ADD CONSTRAINT "BusinessWebhookDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "BusinessWebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKeyUsage" ADD CONSTRAINT "ApiKeyUsage_keyId_fkey" FOREIGN KEY ("keyId") REFERENCES "APIKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═════════════════════════════════════════════════════════════════════
-- Database-level financial controls (hand-written).
-- ═════════════════════════════════════════════════════════════════════

-- 1) Append-only tables. Posted ledger entries, audit records and lifecycle
--    history are never edited; corrections are new rows (reversals).
--    DELETE is refused too, except inside a session that explicitly sets
--    `SET LOCAL tazdan.allow_purge = 'on'` (documented purge procedure for
--    test databases and lawful erasure — see docs/regulatory/DATA_RETENTION.md).
CREATE OR REPLACE FUNCTION tazdan_forbid_mutation() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('tazdan.allow_purge', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION '% on %.% is not allowed: table is append-only', TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'LedgerEntry', 'AssetLedgerEntry', 'AuditLog', 'StateTransition',
    'ControlSwitchEvent', 'TreasuryMovement', 'RiskDecision', 'CaseNote',
    'ProviderCall', 'SecurityEvent'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_append_only', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION tazdan_forbid_mutation()',
      t || '_append_only', t
    );
  END LOOP;
END $$;

-- 2) Double-entry invariant at commit. Every ledger group must sum to zero
--    per currency. Checked once per inserted row, deferred to COMMIT so a
--    group can be written leg by leg inside one transaction.
CREATE OR REPLACE FUNCTION tazdan_check_ledger_group_balanced() RETURNS trigger AS $$
DECLARE s numeric;
BEGIN
  SELECT COALESCE(SUM("amount"), 0) INTO s
  FROM "LedgerEntry"
  WHERE "groupId" = NEW."groupId" AND "currency" = NEW."currency";
  IF ABS(s) > 0.000000000001 THEN
    RAISE EXCEPTION 'Unbalanced ledger group % for %: legs sum to %', NEW."groupId", NEW."currency", s
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "LedgerEntry_balanced_group" ON "LedgerEntry";
CREATE CONSTRAINT TRIGGER "LedgerEntry_balanced_group"
  AFTER INSERT ON "LedgerEntry"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION tazdan_check_ledger_group_balanced();

-- 3) Quotes are price records: once issued, their pricing never changes and
--    a quote can be consumed exactly once.
CREATE OR REPLACE FUNCTION tazdan_protect_remittance_quote() RETURNS trigger AS $$
BEGIN
  IF NEW."sendAmount" IS DISTINCT FROM OLD."sendAmount"
     OR NEW."feeAmount" IS DISTINCT FROM OLD."feeAmount"
     OR NEW."totalDebit" IS DISTINCT FROM OLD."totalDebit"
     OR NEW."baseRate" IS DISTINCT FROM OLD."baseRate"
     OR NEW."customerRate" IS DISTINCT FROM OLD."customerRate"
     OR NEW."spreadPercent" IS DISTINCT FROM OLD."spreadPercent"
     OR NEW."receiveAmount" IS DISTINCT FROM OLD."receiveAmount"
     OR NEW."sourceCurrency" IS DISTINCT FROM OLD."sourceCurrency"
     OR NEW."destCurrency" IS DISTINCT FROM OLD."destCurrency"
     OR NEW."expiresAt" IS DISTINCT FROM OLD."expiresAt"
     OR NEW."userId" IS DISTINCT FROM OLD."userId"
     OR NEW."corridorId" IS DISTINCT FROM OLD."corridorId" THEN
    RAISE EXCEPTION 'RemittanceQuote % is immutable', OLD."id" USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF OLD."consumedAt" IS NOT NULL AND NEW."consumedAt" IS DISTINCT FROM OLD."consumedAt" THEN
    RAISE EXCEPTION 'RemittanceQuote % was already consumed', OLD."id" USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "RemittanceQuote_immutable"
  BEFORE UPDATE ON "RemittanceQuote"
  FOR EACH ROW EXECUTE FUNCTION tazdan_protect_remittance_quote();
CREATE TRIGGER "RemittanceQuote_no_delete"
  BEFORE DELETE ON "RemittanceQuote"
  FOR EACH ROW EXECUTE FUNCTION tazdan_forbid_mutation();

-- 4) Impossible states. New tables validate immediately. On Wallet the checks
--    are NOT VALID: they bind every new write without failing this migration
--    on historical rows (find any with docs/runbooks/balance-drift.md).
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_balance_non_negative" CHECK ("balance" >= 0) NOT VALID;
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_frozen_non_negative" CHECK ("frozen" >= 0) NOT VALID;

ALTER TABLE "RemittanceQuote" ADD CONSTRAINT "RemittanceQuote_positive"
  CHECK ("sendAmount" > 0 AND "feeAmount" >= 0 AND "totalDebit" = "sendAmount" + "feeAmount"
         AND "baseRate" > 0 AND "customerRate" > 0 AND "receiveAmount" > 0);
ALTER TABLE "RemittanceTransfer" ADD CONSTRAINT "RemittanceTransfer_positive"
  CHECK ("sendAmount" > 0 AND "feeAmount" >= 0 AND "totalDebit" = "sendAmount" + "feeAmount" AND "receiveAmount" > 0);
ALTER TABLE "RemittancePayout" ADD CONSTRAINT "RemittancePayout_positive" CHECK ("amount" > 0);
ALTER TABLE "RemittanceRefund" ADD CONSTRAINT "RemittanceRefund_positive" CHECK ("amount" > 0);
ALTER TABLE "RemittanceSettlement" ADD CONSTRAINT "RemittanceSettlement_positive" CHECK ("amount" > 0);
ALTER TABLE "TreasuryMovement" ADD CONSTRAINT "TreasuryMovement_positive" CHECK ("amount" > 0);
ALTER TABLE "TreasuryPool" ADD CONSTRAINT "TreasuryPool_thresholds"
  CHECK ("minimum" >= 0 AND "target" >= "minimum" AND "maxExposure" >= 0);
ALTER TABLE "BusinessPayout" ADD CONSTRAINT "BusinessPayout_positive"
  CHECK ("amount" > 0 AND "feeAmount" >= 0 AND "netAmount" > 0);

-- A remittance can have at most one payout in flight at a time.
CREATE UNIQUE INDEX "RemittancePayout_one_open_per_transfer"
  ON "RemittancePayout" ("transferId") WHERE "status" IN ('PENDING', 'SUBMITTED');
