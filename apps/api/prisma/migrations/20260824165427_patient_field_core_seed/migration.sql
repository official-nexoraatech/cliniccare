-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PatientFieldDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL DEFAULT 'TEXT',
    "options" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isCore" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_PatientFieldDefinition" ("createdAt", "fieldType", "id", "isActive", "key", "label", "options", "order", "required", "updatedAt") SELECT "createdAt", "fieldType", "id", "isActive", "key", "label", "options", "order", "required", "updatedAt" FROM "PatientFieldDefinition";
DROP TABLE "PatientFieldDefinition";
ALTER TABLE "new_PatientFieldDefinition" RENAME TO "PatientFieldDefinition";
CREATE UNIQUE INDEX "PatientFieldDefinition_key_key" ON "PatientFieldDefinition"("key");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
