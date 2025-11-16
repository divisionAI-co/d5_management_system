-- CreateTable
CREATE TABLE "rate_limit_attempts" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_limit_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "failed_login_attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "failed_login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_lockouts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lockedUntil" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_lockouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rate_limit_attempts_identifier_type_idx" ON "rate_limit_attempts"("identifier", "type");

-- CreateIndex
CREATE INDEX "rate_limit_attempts_createdAt_idx" ON "rate_limit_attempts"("createdAt");

-- CreateIndex
CREATE INDEX "failed_login_attempts_userId_idx" ON "failed_login_attempts"("userId");

-- CreateIndex
CREATE INDEX "failed_login_attempts_createdAt_idx" ON "failed_login_attempts"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "account_lockouts_userId_key" ON "account_lockouts"("userId");

-- CreateIndex
CREATE INDEX "account_lockouts_userId_idx" ON "account_lockouts"("userId");

-- CreateIndex
CREATE INDEX "account_lockouts_lockedUntil_idx" ON "account_lockouts"("lockedUntil");

-- AddForeignKey
ALTER TABLE "failed_login_attempts" ADD CONSTRAINT "failed_login_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_lockouts" ADD CONSTRAINT "account_lockouts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
