-- AlterTable
ALTER TABLE "App" ADD COLUMN     "downloadCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "icon" TEXT,
ADD COLUMN     "latestReportsHash" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "latestReportsRef" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Version" ADD COLUMN     "releaseNotes" TEXT;

-- CreateTable
CREATE TABLE "Report" (
    "id" SERIAL NOT NULL,
    "appId" INTEGER NOT NULL,
    "reporter" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "aggregated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Report_appId_idx" ON "Report"("appId");

-- CreateIndex
CREATE UNIQUE INDEX "Report_appId_reporter_key" ON "Report"("appId", "reporter");

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
