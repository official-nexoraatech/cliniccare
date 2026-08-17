-- CreateTable
CREATE TABLE "Medicine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brandName" TEXT NOT NULL,
    "genericName" TEXT,
    "strength" TEXT,
    "form" TEXT NOT NULL,
    "company" TEXT,
    "category" TEXT,
    "defaultDose" TEXT,
    "defaultMorning" INTEGER NOT NULL DEFAULT 0,
    "defaultAfternoon" INTEGER NOT NULL DEFAULT 0,
    "defaultEvening" INTEGER NOT NULL DEFAULT 0,
    "defaultNight" INTEGER NOT NULL DEFAULT 0,
    "defaultBeforeAfterFood" TEXT NOT NULL DEFAULT 'ANYTIME',
    "defaultDurationDays" INTEGER,
    "defaultInstruction" TEXT,
    "isFavourite" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Medicine_brandName_idx" ON "Medicine"("brandName");

-- CreateIndex
CREATE INDEX "Medicine_genericName_idx" ON "Medicine"("genericName");
