-- CreateTable
CREATE TABLE "App" (
    "id" INTEGER NOT NULL,
    "publisher" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "tags" TEXT[],
    "latestVersionId" INTEGER NOT NULL,
    "latestReviewsHash" TEXT NOT NULL DEFAULT '',
    "latestReviewsRef" TEXT NOT NULL DEFAULT '',
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "App_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Version" (
    "id" SERIAL NOT NULL,
    "appId" INTEGER NOT NULL,
    "versionId" INTEGER NOT NULL,
    "torrentRef" TEXT NOT NULL,
    "sha256Digest" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" SERIAL NOT NULL,
    "appId" INTEGER NOT NULL,
    "reviewer" TEXT NOT NULL,
    "rating" INTEGER,
    "reviewText" TEXT NOT NULL,
    "isDeveloper" BOOLEAN NOT NULL DEFAULT false,
    "aggregated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncState" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "lastBlock" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "App_name_idx" ON "App"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Version_appId_versionId_key" ON "Version"("appId", "versionId");

-- CreateIndex
CREATE INDEX "Review_appId_idx" ON "Review"("appId");

-- AddForeignKey
ALTER TABLE "Version" ADD CONSTRAINT "Version_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
