import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, CalendarClock, XCircle } from 'lucide-react';
import { usePublicAppointmentQuery, useRespondToReminderMutation } from '@/hooks/useAppointments';
import { InlineSkeleton } from '@/components/Skeleton';
import { getErrorMessage } from '@/lib/utils';

const RESPONDABLE_STATUSES = ['BOOKED', 'CONFIRMED'];

/** Public page opened from the WhatsApp reminder link — no login, reached straight off
 * a patient's own phone. Deliberately shows nothing beyond what's needed to answer. */
export function ConfirmAppointmentPage() {
  const { id } = useParams<{ id: string }>();
  const { data: appointment, isLoading, error, refetch } = usePublicAppointmentQuery(id);
  const respond = useRespondToReminderMutation(id);
  const [choice, setChoice] = useState<'CONFIRM' | 'RESCHEDULE_REQUEST' | null>(null);

  const onRespond = async (response: 'CONFIRM' | 'RESCHEDULE_REQUEST') => {
    try {
      await respond.mutateAsync(response);
      setChoice(response);
    } catch {
      refetch();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4 py-8">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 py-4" aria-busy="true" aria-label="Loading appointment">
            <InlineSkeleton className="h-10 w-10 rounded-full" />
            <InlineSkeleton className="h-5 w-40" />
            <InlineSkeleton className="h-4 w-56" />
            <InlineSkeleton className="h-10 w-full" />
          </div>
        ) : error || !appointment ? (
          <p className="text-center text-sm text-gray-500">
            {getErrorMessage(error, "This appointment link isn't valid or has expired.")}
          </p>
        ) : choice === 'CONFIRM' || (!choice && appointment.status === 'CONFIRMED' && !appointment.rescheduleRequested) ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
            <p className="font-medium text-gray-800">Thanks, {appointment.patientName}!</p>
            <p className="text-sm text-gray-500">
              You're confirmed for {new Date(appointment.appointmentDate).toLocaleDateString('en-IN')} at{' '}
              {appointment.timeSlot}.
            </p>
          </div>
        ) : choice === 'RESCHEDULE_REQUEST' || (!choice && appointment.rescheduleRequested) ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <CalendarClock className="h-10 w-10 text-amber-600" />
            <p className="font-medium text-gray-800">Got it, {appointment.patientName}.</p>
            <p className="text-sm text-gray-500">{appointment.clinicName} will call you to reschedule.</p>
          </div>
        ) : !RESPONDABLE_STATUSES.includes(appointment.status) ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <XCircle className="h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-500">This appointment is no longer awaiting a response.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 text-center">
            <div>
              <h1 className="text-lg font-bold text-[var(--color-navy)]">{appointment.clinicName}</h1>
              <p className="mt-2 text-sm text-gray-600">
                Hi {appointment.patientName}, your appointment is on{' '}
                <span className="font-medium text-gray-800">
                  {new Date(appointment.appointmentDate).toLocaleDateString('en-IN')}
                </span>{' '}
                at <span className="font-medium text-gray-800">{appointment.timeSlot}</span>.
              </p>
              <p className="mt-1 text-sm text-gray-600">Will you be coming?</p>
            </div>

            <button
              onClick={() => onRespond('CONFIRM')}
              disabled={respond.isPending}
              className="flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" /> Yes, I'll be there
            </button>
            <button
              onClick={() => onRespond('RESCHEDULE_REQUEST')}
              disabled={respond.isPending}
              className="flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
            >
              <CalendarClock className="h-4 w-4" /> No, need to reschedule
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
