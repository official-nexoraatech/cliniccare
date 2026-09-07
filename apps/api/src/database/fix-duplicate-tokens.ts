import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * One-off repair for data that predates the @@unique([appointmentDate, tokenNo]) index on
 * Appointment: two concurrent bookings could previously be handed the same token number
 * for the same day (see AppointmentsService.nextTokenForDay). `prisma db push` refuses to
 * build the index while duplicates exist, so this must run once before that push succeeds.
 *
 * Non-destructive — no appointment is deleted or otherwise changed except its `tokenNo`.
 * For each (appointmentDate, tokenNo) pair shared by more than one appointment, the
 * earliest-created one keeps its number; every later one is renumbered to the next token
 * number not already used that day.
 */
async function fixDuplicateTokens(): Promise<void> {
  const appointments = await prisma.appointment.findMany({
    select: { id: true, appointmentDate: true, tokenNo: true, patientName: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const byDay = new Map<number, typeof appointments>();
  for (const appt of appointments) {
    const dayKey = appt.appointmentDate.getTime();
    const list = byDay.get(dayKey) ?? [];
    list.push(appt);
    byDay.set(dayKey, list);
  }

  let fixedCount = 0;
  for (const [dayKey, dayAppointments] of byDay) {
    const usedTokens = new Set(dayAppointments.map((a) => a.tokenNo));
    let nextFreeToken = Math.max(...dayAppointments.map((a) => a.tokenNo)) + 1;

    const seenTokens = new Set<number>();
    for (const appt of dayAppointments) {
      if (!seenTokens.has(appt.tokenNo)) {
        seenTokens.add(appt.tokenNo);
        continue;
      }

      // Second (or later) appointment to claim this token number on this day — bump it to
      // a fresh one instead.
      while (usedTokens.has(nextFreeToken)) nextFreeToken += 1;
      const newToken = nextFreeToken;
      usedTokens.add(newToken);

      await prisma.appointment.update({ where: { id: appt.id }, data: { tokenNo: newToken } });
      console.log(
        `Renumbered "${appt.patientName}" on ${new Date(dayKey).toISOString().slice(0, 10)}: token ${appt.tokenNo} -> ${newToken}`,
      );
      fixedCount += 1;
    }
  }

  console.log(fixedCount === 0 ? 'No duplicate tokens found.' : `Fixed ${fixedCount} duplicate token(s).`);
}

fixDuplicateTokens()
  .catch((error) => {
    console.error('Failed to fix duplicate tokens', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
