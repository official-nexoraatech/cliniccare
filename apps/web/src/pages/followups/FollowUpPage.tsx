import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CalendarClock, ListChecks, MessageCircle, Phone, PhoneOff, PhoneCall as PhoneCallIcon } from 'lucide-react';
import type { ContactResult, FollowUpCounts, FollowUpItem } from '@clinic-care/shared-types';
import { ComplianceBadge } from '@/components/ComplianceBadge';
import { FormModal } from '@/components/FormModal';
import { CardGridSkeleton } from '@/components/Skeleton';
import { pageStackClass, sectionCardClass } from '@/components/uiStyles';
import { useFollowUpCountsQuery, useFollowUpListQuery, useFollowUpMutations } from '@/hooks/useFollowUps';
import { cn, getErrorMessage } from '@/lib/utils';
import { useClinicQuery } from '@/hooks/useClinic';
import { useWhatsAppTemplatesQuery } from '@/hooks/useWhatsAppTemplates';
import { renderWhatsAppTemplate } from '@/lib/whatsappTemplates';

type View = 'due' | 'overdue' | 'upcoming' | 'missed' | 'call-list';

const CARDS: { key: View; label: string; countKey: keyof FollowUpCounts }[] = [
  { key: 'due', label: 'Due Today', countKey: 'dueToday' },
  { key: 'overdue', label: 'Overdue', countKey: 'overdue' },
  { key: 'upcoming', label: 'Upcoming This Week', countKey: 'upcomingThisWeek' },
  { key: 'missed', label: 'Missed This Month', countKey: 'missedThisMonth' },
];

const VIEW_META: Record<View, { label: string; description: string; emptyTitle: string; emptyText: string; tone: string }> = {
  due: {
    label: 'Due today',
    description: 'Patients expected for follow-up today.',
    emptyTitle: 'No follow-ups due today',
    emptyText: 'Today is clear. Check overdue patients or upcoming visits if you want to plan ahead.',
    tone: 'border-blue-200 bg-blue-50 text-blue-700',
  },
  overdue: {
    label: 'Overdue',
    description: 'Patients who missed the expected follow-up date.',
    emptyTitle: 'No overdue follow-ups',
    emptyText: 'Good state. Nobody is pending beyond their due date.',
    tone: 'border-red-200 bg-red-50 text-red-700',
  },
  upcoming: {
    label: 'Upcoming this week',
    description: 'Patients coming due soon.',
    emptyTitle: 'No upcoming follow-ups this week',
    emptyText: 'There are no follow-ups scheduled in the next few days.',
    tone: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  missed: {
    label: 'Missed this month',
    description: 'Follow-ups missed during this month.',
    emptyTitle: 'No missed follow-ups this month',
    emptyText: 'This month has no missed follow-up entries.',
    tone: 'border-slate-200 bg-slate-50 text-slate-700',
  },
  'call-list': {
    label: "Today's call list",
    description: 'Due today and overdue patients, ready for reception calling.',
    emptyTitle: 'Call list is clear',
    emptyText: 'There are no patients to call from the due or overdue list.',
    tone: 'border-teal-200 bg-teal-50 text-teal-700',
  },
};

function waLink(mobile: string, message: string) {
  return `https://wa.me/91${mobile}?text=${encodeURIComponent(message)}`;
}

function FollowUpRow({ item, clinicName, followUpTemplate }: { item: FollowUpItem; clinicName?: string; followUpTemplate?: string }) {
  const navigate = useNavigate();
  const { markContacted, reschedule } = useFollowUpMutations();
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [reason, setReason] = useState('');

  const quickContact = async (result: ContactResult) => {
    try {
      await markContacted.mutateAsync({ id: item.id, payload: { contactMode: 'CALL', contactResult: result } });
      toast.success('Follow-up updated');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not update follow-up.'));
    }
  };

  const onReschedule = async () => {
    if (!newDate) return;
    try {
      await reschedule.mutateAsync({ id: item.id, payload: { newDate, reason: reason || undefined } });
      toast.success('Follow-up rescheduled');
      setRescheduleOpen(false);
      setNewDate('');
      setReason('');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not reschedule follow-up.'));
    }
  };

  const wasContactedToday = item.contactedOn && new Date(item.contactedOn).toDateString() === new Date().toDateString();

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50 transition hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-200/70">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => navigate(`/patients/${item.patientId}`)}
              className="text-base font-semibold text-[var(--color-navy)] hover:underline"
            >
              {item.patient.name}
            </button>
            <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
              {item.patient.age}/{item.patient.gender.charAt(0)}
            </span>
            <span className="text-xs font-medium text-slate-400">{item.patient.mobile}</span>
            {item.patient.chronicDiseases && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Chronic</span>
            )}
            {item.latestCompliancePercent !== null && (
              <ComplianceBadge
                percent={item.latestCompliancePercent}
                grade={item.latestCompliancePercent >= 80 ? 'GOOD' : item.latestCompliancePercent >= 50 ? 'AVERAGE' : 'POOR'}
              />
            )}
            {wasContactedToday && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                Contacted today
              </span>
            )}
          </div>

          <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <p className="min-w-0 truncate">
              {item.lastDiagnosis ? (
                <>
                  <span className="font-semibold text-slate-800">Diagnosis:</span> {item.lastDiagnosis}
                </>
              ) : (
                <span className="text-slate-400">No diagnosis recorded</span>
              )}
              {item.lastPrescriptionSummary && <span className="text-slate-400"> | Rx: {item.lastPrescriptionSummary}</span>}
            </p>
            <span
              className={cn(
                'w-fit rounded-lg px-2.5 py-1 text-xs font-semibold',
                item.daysOverdue > 0 ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600',
              )}
            >
              Due {new Date(item.dueDate).toLocaleDateString('en-IN')}
              {item.daysOverdue > 0 && ` | ${item.daysOverdue} days late`}
            </span>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2 lg:justify-end">
          <a
            href={`tel:${item.patient.mobile}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:-translate-y-0.5 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-100"
            title="Call"
          >
            <Phone className="h-4 w-4" />
          </a>
          <a
            href={waLink(
              item.patient.mobile,
              renderWhatsAppTemplate(followUpTemplate, 'followUpReminder', {
                patientName: item.patient.name,
                clinicName: clinicName ?? 'the clinic',
                dueDate: new Date(item.dueDate).toLocaleDateString('en-IN'),
                daysOverdue: item.daysOverdue,
                lastDiagnosis: item.lastDiagnosis,
              }),
            )}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-green-200 text-green-600 transition hover:-translate-y-0.5 hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-100"
            title="WhatsApp"
          >
            <MessageCircle className="h-4 w-4" />
          </a>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        <button
          onClick={() => quickContact('WILL_COME')}
          className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 transition hover:bg-green-100"
        >
          <PhoneCallIcon className="h-3.5 w-3.5" /> Will Come
        </button>
        <button
          onClick={() => quickContact('COMING_LATER')}
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
        >
          Coming Later
        </button>
        <button
          onClick={() => quickContact('NO_ANSWER')}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
        >
          <PhoneOff className="h-3.5 w-3.5" /> No Answer
        </button>
        <button
          onClick={() => quickContact('NOT_INTERESTED')}
          className="rounded-lg border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100"
        >
          Not Interested
        </button>
        <button
          onClick={() => setRescheduleOpen(true)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-teal-200 hover:bg-teal-50 hover:text-[var(--color-primary)]"
        >
          <CalendarClock className="h-3.5 w-3.5" /> Reschedule
        </button>
      </div>

      <FormModal
        open={rescheduleOpen}
        title={`Reschedule - ${item.patient.name}`}
        size="sm"
        onClose={() => setRescheduleOpen(false)}
        footer={
          <>
            <button
              onClick={() => setRescheduleOpen(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={onReschedule}
              disabled={!newDate || reschedule.isPending}
              className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              Save
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">New date</label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Reason (optional)</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            />
          </div>
        </div>
      </FormModal>
    </article>
  );
}

export function FollowUpPage() {
  const { data: counts } = useFollowUpCountsQuery();
  const [view, setView] = useState<View>('due');
  const { data: items, isLoading } = useFollowUpListQuery(view);
  const { data: clinic } = useClinicQuery();
  const { data: whatsAppTemplates } = useWhatsAppTemplatesQuery();

  const calledToday = useMemo(
    () => (items ?? []).filter((i) => i.contactedOn && new Date(i.contactedOn).toDateString() === new Date().toDateString()).length,
    [items],
  );

  const selectedMeta = VIEW_META[view];
  const callListCount = (counts?.dueToday ?? 0) + (counts?.overdue ?? 0);

  return (
    <div className={pageStackClass}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-navy)]">Follow-up</h1>
          <p className="mt-1 text-sm text-slate-500">Track due patients, contact them, and reschedule without losing the thread.</p>
        </div>
        <div className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-500 shadow-sm shadow-slate-200/70">
          {selectedMeta.label} view
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {CARDS.map((card) => (
          <button
            key={card.key}
            onClick={() => setView(card.key)}
            className={cn(
              'rounded-xl border bg-white p-4 text-left shadow-sm shadow-slate-200/50 transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-teal-100',
              view === card.key ? VIEW_META[card.key].tone : 'border-slate-200 text-slate-600 hover:bg-slate-50',
            )}
          >
            <p className="text-3xl font-bold tabular-nums">{counts?.[card.countKey] ?? '-'}</p>
            <p className="mt-1 text-sm font-semibold">{card.label}</p>
            <p className="mt-1 text-xs opacity-80">{VIEW_META[card.key].description}</p>
          </button>
        ))}
      </div>

      <button
        onClick={() => setView('call-list')}
        className={cn(
          sectionCardClass,
          'flex w-full items-center justify-between gap-4 text-left transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-teal-100',
          view === 'call-list' && 'border-teal-200 bg-teal-50 text-teal-700',
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-teal-100 text-teal-700">
            <ListChecks className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Today's call list</p>
            <p className="text-xs text-slate-500">Due today + overdue, prioritised for reception calling</p>
          </div>
        </div>
        <span className="rounded-lg bg-white px-3 py-1.5 text-sm font-bold tabular-nums text-teal-700 shadow-sm shadow-teal-100">
          {callListCount}
        </span>
      </button>

      {view === 'call-list' && (
        <div className="rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-700">
          {calledToday} of {items?.length ?? 0} contacted today
        </div>
      )}

      <section className={sectionCardClass}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-navy)]">{selectedMeta.label}</h2>
            <p className="text-sm text-slate-500">{selectedMeta.description}</p>
          </div>
          <span className={cn('rounded-lg border px-3 py-1.5 text-xs font-semibold', selectedMeta.tone)}>
            {items?.length ?? 0} patient{items?.length === 1 ? '' : 's'}
          </span>
        </div>

        {isLoading ? (
          <CardGridSkeleton count={3} />
        ) : !items || items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-14 text-center">
            <ListChecks className="h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">{selectedMeta.emptyTitle}</p>
            <p className="mt-1 max-w-md text-sm text-slate-400">{selectedMeta.emptyText}</p>
            {view !== 'call-list' && callListCount > 0 && (
              <button
                onClick={() => setView('call-list')}
                className="mt-4 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:opacity-95"
              >
                Open call list
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {items.map((item) => (
              <FollowUpRow
                key={item.id}
                item={item}
                clinicName={clinic?.name}
                followUpTemplate={whatsAppTemplates?.templates.followUpReminder}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
