-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "certificateNo" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "visitId" TEXT,
    "type" TEXT NOT NULL,
    "issueDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fromDate" DATETIME,
    "toDate" DATETIME,
    "diagnosis" TEXT,
    "bodyText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "cancelReason" TEXT,
    "issuedBy" TEXT,
    "printedAt" DATETIME,
    "printCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Certificate_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_certificateNo_key" ON "Certificate"("certificateNo");

-- CreateIndex
CREATE INDEX "Certificate_patientId_idx" ON "Certificate"("patientId");

-- CreateIndex
CREATE INDEX "Certificate_issueDate_idx" ON "Certificate"("issueDate");
