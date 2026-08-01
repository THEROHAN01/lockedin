-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "RoadmapStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProgressEventType" AS ENUM ('COMPLETED');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmap" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "sendTimeLocal" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "status" "RoadmapStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roadmap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmap_item" (
    "id" TEXT NOT NULL,
    "roadmapId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roadmap_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_event" (
    "id" TEXT NOT NULL,
    "roadmapId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" "ProgressEventType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progress_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "send_log" (
    "id" TEXT NOT NULL,
    "roadmapId" TEXT NOT NULL,
    "localDate" DATE NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "send_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "roadmap_status_idx" ON "roadmap"("status");

-- CreateIndex
CREATE INDEX "roadmap_userId_idx" ON "roadmap"("userId");

-- CreateIndex
CREATE INDEX "roadmap_item_roadmapId_position_idx" ON "roadmap_item"("roadmapId", "position");

-- CreateIndex
CREATE INDEX "progress_event_roadmapId_type_idx" ON "progress_event"("roadmapId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "progress_event_itemId_type_key" ON "progress_event"("itemId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "send_log_roadmapId_localDate_key" ON "send_log"("roadmapId", "localDate");

-- AddForeignKey
ALTER TABLE "roadmap" ADD CONSTRAINT "roadmap_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_item" ADD CONSTRAINT "roadmap_item_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "roadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_event" ADD CONSTRAINT "progress_event_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "roadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_event" ADD CONSTRAINT "progress_event_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "roadmap_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "send_log" ADD CONSTRAINT "send_log_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "roadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
