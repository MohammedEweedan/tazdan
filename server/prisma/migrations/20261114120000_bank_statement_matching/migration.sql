-- CreateTable
CREATE TABLE "BankStatementImport" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "platformBankAccountId" TEXT,
    "fileName" TEXT,
    "contentSha256" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "lineCount" INTEGER NOT NULL DEFAULT 0,
    "newLines" INTEGER NOT NULL DEFAULT 0,
    "duplicateLines" INTEGER NOT NULL DEFAULT 0,
    "skippedRows" INTEGER NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "importedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankStatementImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankStatementLine" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "platformBankAccountId" TEXT,
    "direction" TEXT NOT NULL,
    "amount" DECIMAL(20,8) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'LYD',
    "valueDate" TIMESTAMP(3) NOT NULL,
    "railRef" TEXT,
    "narration" TEXT,
    "counterpartyName" TEXT,
    "counterpartyAccount" TEXT,
    "counterpartyBank" TEXT,
    "accountKey" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNMATCHED',
    "matchedType" TEXT,
    "matchedId" TEXT,
    "matchedById" TEXT,
    "matchedAt" TIMESTAMP(3),
    "bestScore" INTEGER,
    "flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" TEXT,
    "raw" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankStatementLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankMatchCandidate" (
    "id" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "signals" JSONB NOT NULL,
    "flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankMatchCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankPayerLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountKey" TEXT NOT NULL,
    "name" TEXT,
    "source" TEXT NOT NULL,
    "confirmedById" TEXT,
    "timesSeen" INTEGER NOT NULL DEFAULT 1,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankPayerLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankInfoRequest" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "bankContact" TEXT,
    "type" TEXT NOT NULL,
    "legalBasis" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "subjectUserId" TEXT,
    "statementLineId" TEXT,
    "caseId" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "dueAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "sentAt" TIMESTAMP(3),
    "answeredAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankInfoRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BankStatementImport_contentSha256_key" ON "BankStatementImport"("contentSha256");

-- CreateIndex
CREATE INDEX "BankStatementImport_source_createdAt_idx" ON "BankStatementImport"("source", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BankStatementLine_dedupeKey_key" ON "BankStatementLine"("dedupeKey");

-- CreateIndex
CREATE INDEX "BankStatementLine_status_direction_idx" ON "BankStatementLine"("status", "direction");

-- CreateIndex
CREATE INDEX "BankStatementLine_accountKey_idx" ON "BankStatementLine"("accountKey");

-- CreateIndex
CREATE INDEX "BankStatementLine_valueDate_idx" ON "BankStatementLine"("valueDate");

-- CreateIndex
CREATE UNIQUE INDEX "BankStatementLine_matchedType_matchedId_key" ON "BankStatementLine"("matchedType", "matchedId");

-- CreateIndex
CREATE INDEX "BankMatchCandidate_targetType_targetId_idx" ON "BankMatchCandidate"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "BankMatchCandidate_lineId_targetType_targetId_key" ON "BankMatchCandidate"("lineId", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "BankPayerLink_accountKey_idx" ON "BankPayerLink"("accountKey");

-- CreateIndex
CREATE UNIQUE INDEX "BankPayerLink_userId_accountKey_key" ON "BankPayerLink"("userId", "accountKey");

-- CreateIndex
CREATE UNIQUE INDEX "BankInfoRequest_reference_key" ON "BankInfoRequest"("reference");

-- CreateIndex
CREATE INDEX "BankInfoRequest_status_direction_idx" ON "BankInfoRequest"("status", "direction");

-- CreateIndex
CREATE INDEX "BankInfoRequest_subjectUserId_idx" ON "BankInfoRequest"("subjectUserId");

-- AddForeignKey
ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_importId_fkey" FOREIGN KEY ("importId") REFERENCES "BankStatementImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankMatchCandidate" ADD CONSTRAINT "BankMatchCandidate_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "BankStatementLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

