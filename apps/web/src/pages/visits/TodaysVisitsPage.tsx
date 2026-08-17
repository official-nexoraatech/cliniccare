import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Play, Stethoscope } from 'lucide-react';
import type { TodayVisitItem, VisitStatus } from '@clinic-care/shared-types';
import { useTodaysVisitsQuery, useVisitMutations } from '@/hooks/useVisits';
import { cn, getErrorMessage } from '@/lib/utils';

const STATUS_STYLE: Record<VisitStatus, string> = {
  WAITING: 'bg-amber-100 text-amber-700',
  IN_CONSULTATION: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

export function TodaysVisitsPage() {
  const navigate = useNavigate();
  const { data: visits, isLoading } = useTodaysVisitsQuery();
  const { start } = useVisitMutations();

  const onStart = async (visit: TodayVisitItem) => {
    try {
      if (visit.status === 'WAITING') {
        await start.mutateAsync(visit.id);
      }
      navigate(`/visits/${visit.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not start consultation.'));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-navy)]">Today's OPD</h1>
        <p className="text-sm text-gray-500">
          {visits?.length ?? 0} visit{visits?.length === 1 ? '' : 's'} today
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : !visits || visits.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <Stethoscope className="h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm text-gray-400">No visits yet today. Start one from a patient's profile.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Visit No</th>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visits.map((visit) => (
                <tr key={visit.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{visit.visitNo}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{visit.patient.name}</div>
                    <div className="text-xs text-gray-400">
                      {visit.patient.age}/{visit.patient.gender.charAt(0)} · {visit.patient.mobile}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(visit.visitDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_STYLE[visit.status])}>
                      {visit.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {visit.status === 'COMPLETED' || visit.status === 'CANCELLED' ? (
                      <button
                        onClick={() => navigate(`/visits/${visit.id}`)}
                        className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        View
                      </button>
                    ) : (
                      <button
                        onClick={() => onStart(visit)}
                        className="flex items-center gap-1 rounded-lg bg-[var(--color-primary)] px-2.5 py-1 text-xs font-medium text-white hover:opacity-90"
                      >
                        <Play className="h-3 w-3" />
                        {visit.status === 'WAITING' ? 'Start Consultation' : 'Continue'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
