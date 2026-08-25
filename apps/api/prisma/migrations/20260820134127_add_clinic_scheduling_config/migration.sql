-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Clinic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "doctorName" TEXT,
    "degree" TEXT,
    "regnNumber" TEXT,
    "logoPath" TEXT,
    "letterheadPath" TEXT,
    "openTime" TEXT NOT NULL DEFAULT '09:00',
    "closeTime" TEXT NOT NULL DEFAULT '20:00',
    "slotMinutes" INTEGER NOT NULL DEFAULT 15,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Clinic" ("address", "createdAt", "degree", "doctorName", "email", "id", "letterheadPath", "logoPath", "name", "phone", "regnNumber", "updatedAt") SELECT "address", "createdAt", "degree", "doctorName", "email", "id", "letterheadPath", "logoPath", "name", "phone", "regnNumber", "updatedAt" FROM "Clinic";
DROP TABLE "Clinic";
ALTER TABLE "new_Clinic" RENAME TO "Clinic";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
