-- CreateEnum
CREATE TYPE "BlogStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CaseStudyStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'CONTENT_EDITOR';

-- CreateTable
CREATE TABLE "blogs" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT NOT NULL,
    "featuredImage" TEXT,
    "status" "BlogStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "authorId" TEXT NOT NULL,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_studies" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT NOT NULL,
    "featuredImage" TEXT,
    "status" "CaseStudyStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "authorId" TEXT NOT NULL,
    "clientName" TEXT,
    "clientLogo" TEXT,
    "industry" TEXT,
    "projectDate" TIMESTAMP(3),
    "results" JSONB,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_studies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blogs_slug_key" ON "blogs"("slug");

-- CreateIndex
CREATE INDEX "blogs_status_idx" ON "blogs"("status");

-- CreateIndex
CREATE INDEX "blogs_authorId_idx" ON "blogs"("authorId");

-- CreateIndex
CREATE INDEX "blogs_publishedAt_idx" ON "blogs"("publishedAt");

-- CreateIndex
CREATE INDEX "blogs_slug_idx" ON "blogs"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "case_studies_slug_key" ON "case_studies"("slug");

-- CreateIndex
CREATE INDEX "case_studies_status_idx" ON "case_studies"("status");

-- CreateIndex
CREATE INDEX "case_studies_authorId_idx" ON "case_studies"("authorId");

-- CreateIndex
CREATE INDEX "case_studies_publishedAt_idx" ON "case_studies"("publishedAt");

-- CreateIndex
CREATE INDEX "case_studies_slug_idx" ON "case_studies"("slug");

-- AddForeignKey
ALTER TABLE "blogs" ADD CONSTRAINT "blogs_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_studies" ADD CONSTRAINT "case_studies_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
