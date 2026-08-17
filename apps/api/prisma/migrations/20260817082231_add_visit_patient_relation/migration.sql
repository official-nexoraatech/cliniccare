-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Visit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "visitNo" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT,
    "visitDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visitType" TEXT NOT NULL DEFAULT 'NEW',
    "complaint" TEXT,
    "complaintDurationDays" INTEGER,
    "examination" TEXT,
    "diagnosis" TEXT,
    "advice" TEXT,
    "testsAdvised" TEXT,
    "nextFollowUpDate" DATETIME,
    "followUpAfterDays" INTEGER,
    "consultationFee" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "remark" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Visit_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Visit" ("advice", "complaint", "complaintDurationDays", "consultationFee", "createdAt", "createdBy", "diagnosis", "doctorId", "examination", "followUpAfterDays", "id", "nextFollowUpDate", "patientId", "remark", "status", "testsAdvised", "updatedAt", "visitDate", "visitNo", "visitType") SELECT "advice", "complaint", "complaintDurationDays", "consultationFee", "createdAt", "createdBy", "diagnosis", "doctorId", "examination", "followUpAfterDays", "id", "nextFollowUpDate", "patientId", "remark", "status", "testsAdvised", "updatedAt", "visitDate", "visitNo", "visitType" FROM "Visit";
DROP TABLE "Visit";
ALTER TABLE "new_Visit" RENAME TO "Visit";
CREATE UNIQUE INDEX "Visit_visitNo_key" ON "Visit"("visitNo");
CREATE INDEX "Visit_patientId_idx" ON "Visit"("patientId");
CREATE INDEX "Visit_visitDate_idx" ON "Visit"("visitDate");
CREATE INDEX "Visit_status_idx" ON "Visit"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
