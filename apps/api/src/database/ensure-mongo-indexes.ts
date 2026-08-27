import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Prisma's MongoDB connector has no schema syntax for a partial/sparse unique index, so
// Bill.visitId (optional — a bill can stand alone with no visit) is deliberately NOT
// declared `@unique` in schema.prisma (see the comment there): a plain unique index on an
// optional Mongo field treats every missing/null value as the same value, so the second
// standalone bill ever created would fail with a duplicate-key error.
//
// This creates the actual constraint by hand instead: unique on visitId, but only for
// documents where it's an actual string, so any number of standalone (no-visit) bills can
// coexist while "one bill per visit" still holds for the ones that do have one.
// createIndexes is idempotent (re-creating an identical index is a no-op), so this is safe
// to run on every boot — see the start:prod script.
async function ensureMongoIndexes(): Promise<void> {
  await prisma.$runCommandRaw({
    createIndexes: 'Bill',
    indexes: [
      {
        key: { visitId: 1 },
        name: 'Bill_visitId_partial_unique',
        unique: true,
        partialFilterExpression: { visitId: { $type: 'string' } },
      },
    ],
  });
}

ensureMongoIndexes()
  .then(() => {
    console.log('Mongo indexes ensured.');
  })
  .catch((error) => {
    console.error('Failed to ensure Mongo indexes', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
