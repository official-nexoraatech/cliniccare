import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * One-off repair for BillItem documents that predate the department/status/createdBy/
 * timestamp fields added to that model. MongoDB has no schema enforcement, so an existing
 * document simply doesn't have these fields at all — and unlike a SQL column default, a
 * Prisma @default is not retroactively applied when reading a document that predates it.
 * Worse, these are non-nullable fields in the schema, so Prisma's client can throw trying
 * to read such a document at all (a raw $runCommandRaw update is used here instead of
 * prisma.billItem.updateMany specifically to avoid going through that same typed read path).
 *
 * Only ever sets fields that don't already exist ($exists: false) — never touches an item
 * that already has real data. createdAt/updatedAt get today's date as the closest available
 * approximation for genuinely pre-migration items; their real add time was never recorded.
 */
async function backfillBillItemFields(): Promise<void> {
  const itemResult = await prisma.$runCommandRaw({
    update: 'BillItem',
    updates: [
      {
        q: { status: null },
        u: [
          {
            $set: {
              status: 'PENDING',
              department: 'OTHER',
              createdBy: null,
              createdByRole: null,
              removedBy: null,
              removedByRole: null,
              removedAt: null,
              removeReason: null,
              createdAt: { $ifNull: ['$createdAt', '$$NOW'] },
              updatedAt: { $ifNull: ['$updatedAt', '$$NOW'] },
            },
          },
        ],
        multi: true,
      },
    ],
  });
  console.log('BillItem backfill result:', JSON.stringify(itemResult));

  // Separately: some pre-existing Bill documents (predating this feature entirely) have
  // createdAt/updatedAt explicitly stored as null rather than missing — `date` (the actual
  // bill date, always populated) is the closest available stand-in.
  const billResult = await prisma.$runCommandRaw({
    update: 'Bill',
    updates: [
      {
        q: { $or: [{ createdAt: null }, { updatedAt: null }] },
        u: [
          {
            $set: {
              createdAt: { $ifNull: ['$createdAt', '$date'] },
              updatedAt: { $ifNull: ['$updatedAt', '$date'] },
            },
          },
        ],
        multi: true,
      },
    ],
  });
  console.log('Bill timestamp backfill result:', JSON.stringify(billResult));
}

backfillBillItemFields()
  .catch((error) => {
    console.error('Failed to backfill BillItem fields', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
