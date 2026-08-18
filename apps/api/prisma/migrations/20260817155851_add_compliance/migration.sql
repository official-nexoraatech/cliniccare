-- CreateTable
CREATE TABLE "Compliance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "recordedOn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dosesPrescribed" INTEGER NOT NULL,
    "dosesTaken" INTEGER NOT NULL,
    "medicinePercent" REAL NOT NULL,
    "followUpsGiven" INTEGER NOT NULL,
    "followUpsAttended" INTEGER NOT NULL,
    "followUpPercent" REAL NOT NULL,
    "overallPercent" REAL NOT NULL,
    "grade" TEXT NOT NULL,
    "reasonForMissing" TEXT,
    "remark" TEXT,
    "recordedBy" TEXT,
    CONSTRAINT "Compliance_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Compliance_patientId_idx" ON "Compliance"("patientId");

-- CreateIndex
CREATE INDEX "Compliance_visitId_idx" ON "Compliance"("visitId");
