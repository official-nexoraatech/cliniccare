import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixAppointmentTokenTypes(): Promise<void> {
  const result = await prisma.$runCommandRaw({
    update: 'Appointment',
    updates: [
      {
        q: { tokenNo: { $type: 'string', $regex: '^[0-9]+$' } },
        u: [{ $set: { tokenNo: { $toInt: '$tokenNo' } } }],
        multi: true,
      },
    ],
  });

  const modified = typeof result === 'object' && result && 'nModified' in result ? result.nModified : 0;
  console.log(`Converted ${String(modified)} appointment tokenNo value(s) from string to number.`);
}

fixAppointmentTokenTypes()
  .catch((error) => {
    console.error('Failed to fix appointment token types', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
