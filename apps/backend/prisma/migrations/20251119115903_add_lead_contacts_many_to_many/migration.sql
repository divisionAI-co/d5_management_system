-- DropForeignKey
ALTER TABLE "leads" DROP CONSTRAINT "leads_contactId_fkey";

-- AlterTable
ALTER TABLE "leads" ALTER COLUMN "contactId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "lead_contacts" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_contacts_leadId_idx" ON "lead_contacts"("leadId");

-- CreateIndex
CREATE INDEX "lead_contacts_contactId_idx" ON "lead_contacts"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "lead_contacts_leadId_contactId_key" ON "lead_contacts"("leadId", "contactId");

-- AddForeignKey
ALTER TABLE "lead_contacts" ADD CONSTRAINT "lead_contacts_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_contacts" ADD CONSTRAINT "lead_contacts_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
