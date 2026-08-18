-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FollowUp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "purpose" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "contactedOn" DATETIME,
    "contactedBy" TEXT,
    "contactMode" TEXT,
    "contactResult" TEXT,
    "rescheduledTo" DATETIME,
    "attendedOn" DATETIME,
    "attendedVisitId" TEXT,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FollowUp_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FollowUp_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_FollowUp" ("attendedOn", "attendedVisitId", "contactMode", "contactResult", "contactedBy", "contactedOn", "createdAt", "dueDate", "id", "patientId", "purpose", "remark", "rescheduledTo", "status", "updatedAt", "visitId") SELECT "attendedOn", "attendedVisitId", "contactMode", "contactResult", "contactedBy", "contactedOn", "createdAt", "dueDate", "id", "patientId", "purpose", "remark", "rescheduledTo", "status", "updatedAt", "visitId" FROM "FollowUp";
DROP TABLE "FollowUp";
ALTER TABLE "new_FollowUp" RENAME TO "FollowUp";
CREATE INDEX "FollowUp_patientId_idx" ON "FollowUp"("patientId");
CREATE INDEX "FollowUp_dueDate_idx" ON "FollowUp"("dueDate");
CREATE INDEX "FollowUp_status_idx" ON "FollowUp"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
