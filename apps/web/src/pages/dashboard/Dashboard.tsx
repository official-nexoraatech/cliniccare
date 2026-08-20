import { useAuthStore } from '@/store/auth-store';
import { useTodaysVisitsQuery } from '@/hooks/useVisits';
import { useAppointmentsByDayQuery } from '@/hooks/useAppointments';
import { useFollowUpCountsQuery } from '@/hooks/useFollowUps';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function Dashboard() {
  const user = useAuthStore((state) => state.user);
  const { data: visits, isLoading: visitsLoading } = useTodaysVisitsQuery();
  const { data: appointments, isLoading: appointmentsLoading } = useAppointmentsByDayQuery(todayIso());
  const { data: followUpCounts, isLoading: followUpsLoading } = useFollowUpCountsQuery();

  // Collection Today is a proxy from each visit's consultation fee, not a real payment
  // ledger — Billing (income/expense) hasn't been built yet, so there is no receipt or
  // payment-status data to sum instead. Revisit once Billing exists.
  const collectionToday = (visits ?? []).reduce((sum, v) => sum + (v.consultationFee ?? 0), 0);

  const cards = [
    { label: "Today's Patients", value: visitsLoading ? '—' : String(visits?.length ?? 0) },
    { label: 'Collection Today', value: visitsLoading ? '—' : `₹${collectionToday}` },
    { label: 'Appointments Today', value: appointmentsLoading ? '—' : String(appointments?.length ?? 0) },
    { label: 'Follow-ups Due', value: followUpsLoading ? '—' : String(followUpCounts?.dueToday ?? 0) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-navy)]">
          Welcome back, {user?.name?.split(' ')[0] ?? 'there'}
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              {card.label}
            </p>
            <p className="mt-2 text-2xl font-bold text-[var(--color-navy)]">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
