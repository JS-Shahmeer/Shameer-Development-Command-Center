-- CreateEnum
CREATE TYPE "BreakdownStatus" AS ENUM ('DRAFT', 'APPROVED', 'DISCARDED');

-- CreateTable
CREATE TABLE "AiBreakdown" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdById" TEXT,
    "requirement" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" "BreakdownStatus" NOT NULL DEFAULT 'DRAFT',
    "draft" JSONB NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdTasks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiBreakdown_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiBreakdown_projectId_createdAt_idx" ON "AiBreakdown"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "AiBreakdown_createdById_createdAt_idx" ON "AiBreakdown"("createdById", "createdAt");

-- AddForeignKey
ALTER TABLE "AiBreakdown" ADD CONSTRAINT "AiBreakdown_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiBreakdown" ADD CONSTRAINT "AiBreakdown_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiBreakdown" ADD CONSTRAINT "AiBreakdown_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Global search: trigram indexes make case-insensitive substring search (ILIKE) fast.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "Project_name_trgm_idx" ON "Project" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "Project_description_trgm_idx" ON "Project" USING GIN ("description" gin_trgm_ops);
CREATE INDEX "Task_title_trgm_idx" ON "Task" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "Task_description_trgm_idx" ON "Task" USING GIN ("description" gin_trgm_ops);
CREATE INDEX "Note_title_trgm_idx" ON "Note" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "Note_body_trgm_idx" ON "Note" USING GIN ("body" gin_trgm_ops);
CREATE INDEX "Client_name_trgm_idx" ON "Client" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "User_name_trgm_idx" ON "User" USING GIN ("name" gin_trgm_ops);
