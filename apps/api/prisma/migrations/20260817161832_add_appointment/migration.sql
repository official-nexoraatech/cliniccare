-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT,
    "patientName" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "appointmentDate" DATETIME NOT NULL,
    "timeSlot" TEXT NOT NULL,
    "tokenNo" INTEGER NOT NULL,
    "doctorId" TEXT,
    "purpose" TEXT,
    "status" TEXT NOT NULL DEFAULT 'BOOKED',
    "source" TEXT NOT NULL DEFAULT 'WALK_IN',
    "remark" TEXT,
    "visitId" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Appointment_appointmentDate_idx" ON "Appointment"("appointmentDate");

-- CreateIndex
CREATE INDEX "Appointment_status_idx" ON "Appointment"("status");

-- CreateIndex
CREATE INDEX "Appointment_patientId_idx" ON "Appointment"("patientId");
