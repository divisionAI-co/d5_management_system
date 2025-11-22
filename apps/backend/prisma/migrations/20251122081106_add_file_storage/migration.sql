-- CreateEnum
CREATE TYPE "FileCategory" AS ENUM ('IMAGE', 'DOCUMENT', 'OTHER');

-- CreateTable
CREATE TABLE "stored_files" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "category" "FileCategory" NOT NULL,
    "path" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "uploadedById" TEXT,
    "blogId" TEXT,
    "caseStudyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stored_files_uploadedById_idx" ON "stored_files"("uploadedById");

-- CreateIndex
CREATE INDEX "stored_files_blogId_idx" ON "stored_files"("blogId");

-- CreateIndex
CREATE INDEX "stored_files_caseStudyId_idx" ON "stored_files"("caseStudyId");

-- CreateIndex
CREATE INDEX "stored_files_category_idx" ON "stored_files"("category");

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_blogId_fkey" FOREIGN KEY ("blogId") REFERENCES "blogs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_caseStudyId_fkey" FOREIGN KEY ("caseStudyId") REFERENCES "case_studies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
