import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CalendarClock, ListChecks, MessageCircle, Phone, PhoneOff, PhoneCall as PhoneCallIcon } from 'lucide-react';
import type { ContactResult, FollowUpCounts, FollowUpItem } from '@clinic-care/shared-types';
import { ComplianceBadge } from '@/components/ComplianceBadge';
import { FormModal } from '@/components/FormModal';
import { useFollowUpCountsQuery, useFollowUpListQuery, useFollowUpMutations } from '@/hooks/useFollowUps';
import { getErrorMessage } from '@/lib/utils';

type View = 'due' | 'overdue' | 'upcoming' | 'missed' | 'call-list';

const CARDS: { key: View; label: string; countKey: keyof FollowUpCounts }[] = [
  { key: 'due', label: 'Due Today', countKey: 'dueToday' },
  { key: 'overdue', label: 'Overdue', countKey: 'overdue' },
  { key: 'upcoming', label: 'Upcoming This Week', countKey: 'upcomingThisWeek' },
  { key: 'missed', label: 'Missed This Month', countKey: 'missedThisMonth' },
];

const CARD_COLOR: Record<View, string> = {
  due: 'border-blue-200 bg-blue-50 text-blue-700',
  overdue: 'border-red-200 bg-red-50 text-red-700',
  upcoming: 'border-amber-200 bg-amber-50 text-amber-700',
  missed: 'border-gray-300 bg-gray-50 text-gray-700',
  'call-list': 'border-teal-200 bg-teal-50 text-teal-700',
};

function waLink(mobile: string, message: string) {
  return `https://wa.me/91${mobile}?text=${encodeURIComponent(message)}`;
}

function FollowUpRow({ item }: { item: FollowUpItem }) {
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
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/patients/${item.patientId}`)}
              className="font-medium text-[var(--color-navy)] hover:underline"
            >
              {item.patient.name}
            </button>
            <span className="text-xs text-gray-400">
              {item.patient.age}/{item.patient.gender.charAt(0)} · {item.patient.mobile}
            </span>
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
          <p className="mt-1 text-xs text-gray-500">
            {item.lastDiagnosis && <span>Diagnosis: {item.lastDiagnosis} · </span>}
            {item.lastPrescriptionSummary && <span>Rx: {item.lastPrescriptionSummary} · </span>}
            Due {new Date(item.dueDate).toLocaleDateString('en-IN')}
            {item.daysOverdue > 0 && <span className="text-red-600"> ({item.daysOverdue} days overdue)</span>}
          </p>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          <a
            href={`tel:${item.patient.mobile}`}
            className="rounded-lg border border-gray-300 p-1.5 text-gray-500 hover:bg-gray-50"
            title="Call"
          >
            <Phone className="h-4 w-4" />
          </a>
          <a
            href={waLink(
              item.patient.mobile,
              `Dear ${item.patient.name}, your follow-up visit is due. Please visit us. Call to book an appointment.`,
            )}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-gray-300 p-1.5 text-green-600 hover:bg-green-50"
            title="WhatsApp"
          >
            <MessageCircle className="h-4 w-4" />
          </a>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
        <button
          onClick={() => quickContact('WILL_COME')}
          className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          <PhoneCallIcon className="h-3.5 w-3.5" /> Will Come
        </button>
        <button
          onClick={() => quickContact('COMING_LATER')}
          className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          Coming Later
        </button>
        <button
          onClick={() => quickContact('NO_ANSWER')}
          className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          <PhoneOff className="h-3.5 w-3.5" /> No Answer
        </button>
        <button
          onClick={() => quickContact('NOT_INTERESTED')}
          className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          Not Interested
        </button>
        <button
          onClick={() => setRescheduleOpen(true)}
          className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          <CalendarClock className="h-3.5 w-3.5" /> Reschedule
        </button>
      </div>

      <FormModal
        open={rescheduleOpen}
        title={`Reschedule — ${item.patient.name}`}
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
    </div>
  );
}

export function FollowUpPage() {
  const { data: counts } = useFollowUpCountsQuery();
  const [view, setView] = useState<View>('due');
  const { data: items, isLoading } = useFollowUpListQuery(view);

  const calledToday = useMemo(
    () => (items ?? []).filter((i) => i.contactedOn && new Date(i.contactedOn).toDateString() === new Date().toDateString()).length,
    [items],
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-navy)]">Follow-up</h1>
        <p className="text-sm text-gray-500">No patient is ever forgotten.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {CARDS.map((card) => (
          <button
            key={card.key}
            onClick={() => setView(card.key)}
            className={`rounded-xl border p-4 text-left transition-opacity ${CARD_COLOR[card.key]} ${
              view === card.key ? '' : 'opacity-70 hover:opacity-100'
            }`}
          >
            <p className="text-2xl font-bold">{counts?.[card.countKey] ?? '—'}</p>
            <p className="text-xs font-medium">{card.label}</p>
          </button>
        ))}
      </div>

      <button
        onClick={() => setView('call-list')}
        className={`flex w-fit items-center gap-2 rounded-xl border p-3 text-left transition-opacity ${CARD_COLOR['call-list']} ${
          view === 'call-list' ? '' : 'opacity-70 hover:opacity-100'
        }`}
      >
        <ListChecks className="h-5 w-5" />
        <div>
          <p className="text-sm font-semibold">Today's Call List</p>
          <p className="text-xs">Due today + overdue, prioritised for the assistant to work down</p>
        </div>
      </button>

      {view === 'call-list' && (
        <p className="text-sm text-gray-500">
          {calledToday} of {items?.length ?? 0} contacted today
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : !items || items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <p className="text-sm text-gray-400">Nothing here.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <FollowUpRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
