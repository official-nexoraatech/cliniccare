import { Link } from 'react-router-dom';
import { ArrowRight, PhoneCall, Users } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { hasPermission } from '@/lib/permissions';
import { useTodaysVisitsQuery } from '@/hooks/useVisits';
import { useAppointmentQueueQuery, useAppointmentsByDayQuery } from '@/hooks/useAppointments';
import { useFollowUpCountsQuery, useFollowUpListQuery } from '@/hooks/useFollowUps';
import { useAccountsSummaryQuery, useDaybookQuery, useOutstandingDuesQuery } from '@/hooks/useAccounts';
import { InlineSkeleton } from '@/components/Skeleton';
import { sectionCardClass, sectionHeaderClass, smallEmptyStateClass } from '@/components/uiStyles';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function money(paise: number | undefined) {
  return `₹${(paise ?? 0).toLocaleString('en-IN')}`;
}

function ViewAllLink({ to }: { to: string }) {
  return (
    <Link to={to} className="flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline">
      View all <ArrowRight className="h-3 w-3" />
    </Link>
  );
}

export function Dashboard() {
  const user = useAuthStore((state) => state.user);
  const canViewBilling = hasPermission(user, 'billing:view');
  const today = todayIso();

  const { data: visits, isLoading: visitsLoading } = useTodaysVisitsQuery();
  const { data: appointments, isLoading: appointmentsLoading } = useAppointmentsByDayQuery(today);
  const { data: queue, isLoading: queueLoading } = useAppointmentQueueQuery();
  const { data: followUpCounts, isLoading: followUpsLoading } = useFollowUpCountsQuery();
  const { data: callList, isLoading: callListLoading } = useFollowUpListQuery('call-list');
  const { data: overdue, isLoading: overdueLoading } = useFollowUpListQuery('overdue');
  const { data: accountsSummary, isLoading: accountsLoading } = useAccountsSummaryQuery(today, today, canViewBilling);
  const { data: dues, isLoading: duesLoading } = useOutstandingDuesQuery(canViewBilling);
  const { data: daybook, isLoading: daybookLoading } = useDaybookQuery(today, canViewBilling);

  const cards = [
    { label: "Today's Patients", value: visitsLoading ? <InlineSkeleton className="h-8 w-16" /> : String(visits?.length ?? 0) },
    { label: 'Appointments Today', value: appointmentsLoading ? <InlineSkeleton className="h-8 w-16" /> : String(appointments?.length ?? 0) },
    { label: 'Follow-ups Due', value: followUpsLoading ? <InlineSkeleton className="h-8 w-16" /> : String(followUpCounts?.dueToday ?? 0) },
    ...(canViewBilling
      ? [
          { label: 'Collection Today', value: accountsLoading ? <InlineSkeleton className="h-8 w-28" /> : money(accountsSummary?.totalCollected) },
          { label: 'Outstanding Dues', value: duesLoading ? <InlineSkeleton className="h-8 w-28" /> : money(dues?.reduce((sum, d) => sum + d.dueAmount, 0)) },
        ]
      : []),
  ];

  const paymentModeBreakdown = daybook?.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.mode] = (acc[entry.mode] ?? 0) + entry.amount;
    return acc;
  }, {});

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
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{card.label}</p>
            <div className="mt-2 text-2xl font-bold text-[var(--color-navy)]">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={sectionCardClass}>
          <div className={`${sectionHeaderClass} justify-between`}>
            <span>Live Queue</span>
            <ViewAllLink to="/appointments/todays-queue" />
          </div>
          {queueLoading ? (
            <InlineSkeleton className="h-24 w-full" />
          ) : queue && queue.waiting > 0 ? (
            <ul className="flex flex-col gap-2">
              {queue.items.slice(0, 5).map((item) => (
                <li key={item.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2 font-medium text-slate-700">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-bold text-white">
                      {item.tokenNo}
                    </span>
                    {item.patientName}
                  </span>
                  <span className="text-xs text-slate-500">{item.doctorName ?? '—'}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className={smallEmptyStateClass}>No one waiting right now</div>
          )}
        </div>

        <div className={sectionCardClass}>
          <div className={`${sectionHeaderClass} justify-between`}>
            <span>Needs Attention</span>
            <ViewAllLink to="/follow-up" />
          </div>
          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <PhoneCall className="h-3.5 w-3.5" /> Call List Today
              </p>
              {callListLoading ? (
                <InlineSkeleton className="h-10 w-full" />
              ) : callList && callList.length > 0 ? (
                <ul className="flex flex-col gap-1.5">
                  {callList.slice(0, 3).map((item) => (
                    <li key={item.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">{item.patient.name}</span>
                      <span className="text-xs text-slate-500">{item.patient.mobile}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400">Nothing pending</p>
              )}
            </div>
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <Users className="h-3.5 w-3.5" /> Overdue Follow-ups
              </p>
              {overdueLoading ? (
                <InlineSkeleton className="h-10 w-full" />
              ) : overdue && overdue.length > 0 ? (
                <ul className="flex flex-col gap-1.5">
                  {overdue.slice(0, 3).map((item) => (
                    <li key={item.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">{item.patient.name}</span>
                      <span className="text-xs font-medium text-red-600">{item.daysOverdue}d overdue</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400">Nothing overdue</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {canViewBilling && (
        <div className={sectionCardClass}>
          <div className={`${sectionHeaderClass} justify-between`}>
            <span>Today's Collection by Mode</span>
            <ViewAllLink to="/accounts" />
          </div>
          {daybookLoading ? (
            <InlineSkeleton className="h-16 w-full" />
          ) : paymentModeBreakdown && Object.keys(paymentModeBreakdown).length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Object.entries(paymentModeBreakdown).map(([mode, amount]) => (
                <div key={mode} className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{mode}</p>
                  <p className="mt-1 text-lg font-semibold text-[var(--color-navy)]">{money(amount)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className={smallEmptyStateClass}>No payments received yet today</div>
          )}
        </div>
      )}
    </div>
  );
}
