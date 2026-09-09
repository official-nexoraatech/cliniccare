import type { ReactNode } from 'react';
import {
  Activity,
  CalendarClock,
  ClipboardList,
  FileText,
  FlaskConical,
  Paperclip,
  Pill,
  Printer,
  StickyNote,
  Stethoscope,
} from 'lucide-react';
import type { BeforeAfterFood, DocumentDetail, PatientHistoryVisit } from '@clinic-care/shared-types';
import { usePrescriptionByVisitQuery } from '@/hooks/usePrescriptions';
import { resolveServerUrl } from '@/lib/api';
import { FormModal } from './FormModal';
import { InlineSkeleton } from './Skeleton';
import { primaryButtonClass, secondaryButtonClass } from './uiStyles';

function foodTimingLabel(value: BeforeAfterFood): string {
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function VisitSection({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-[var(--color-navy)]">
          {icon}
        </span>
        <h3 className="text-sm font-semibold text-[var(--color-navy)]">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function SummaryMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="bg-slate-50 p-4">
      <p className="text-xs font-semibold text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

export function VisitSummaryModal({
  visit,
  documents,
  onClose,
  onEdit,
  onReprint,
}: {
  visit: PatientHistoryVisit;
  documents: DocumentDetail[];
  onClose: () => void;
  onEdit: () => void;
  onReprint: () => void;
}) {
  const { data: prescription, isLoading: prescriptionLoading } = usePrescriptionByVisitQuery(visit.prescription ? visit.id : undefined);
  const visitDocuments = documents.filter((d) => d.visitId === visit.id);
  const formattedVisitDate = new Date(visit.visitDate).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const followUpLabel = visit.nextFollowUpDate
    ? `Next visit on ${new Date(visit.nextFollowUpDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : visit.followUpAfterDays
      ? `After ${visit.followUpAfterDays} days`
      : null;

  const vitalRows = visit.vital
    ? [
        visit.vital.bp ? { label: 'BP', value: visit.vital.bp } : null,
        visit.vital.pulse != null ? { label: 'Pulse', value: `${visit.vital.pulse} /min` } : null,
        visit.vital.temperature != null ? { label: 'Temp', value: `${visit.vital.temperature} deg C` } : null,
        visit.vital.spo2 != null ? { label: 'SpO2', value: `${visit.vital.spo2}%` } : null,
        visit.vital.weight != null ? { label: 'Weight', value: `${visit.vital.weight} kg` } : null,
        visit.vital.sugarRandom != null ? { label: 'Sugar random', value: `${visit.vital.sugarRandom} mg/dL` } : null,
        visit.vital.height != null ? { label: 'Height', value: `${visit.vital.height} cm` } : null,
        visit.vital.bmi != null ? { label: 'BMI', value: visit.vital.bmi } : null,
        visit.vital.respiratoryRate != null ? { label: 'Resp. rate', value: `${visit.vital.respiratoryRate} /min` } : null,
      ]
    : [];
  const vitalTiles = vitalRows.filter((tile): tile is NonNullable<typeof tile> => tile !== null);
  const primaryProblem = visit.diagnosis || visit.complaint || 'Visit summary';

  return (
    <FormModal
      open
      onClose={onClose}
      size="xl"
      title={`Visit on ${formattedVisitDate}`}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Close
          </button>
          {visit.prescription && (
            <button type="button" onClick={onReprint} className={`${secondaryButtonClass} inline-flex items-center gap-1.5`}>
              <Printer className="h-4 w-4" /> Reprint
            </button>
          )}
          <button type="button" onClick={onEdit} className={`${primaryButtonClass} inline-flex items-center gap-1.5`}>
            Edit Visit
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
          <div className="grid lg:grid-cols-[1.5fr_1fr]">
            <div className="bg-white p-5">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-lg bg-[var(--color-navy)] px-2.5 py-1 font-semibold text-white">{visit.visitNo}</span>
                <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">{visit.visitType.replace('_', ' ')}</span>
                {visit.status === 'CANCELLED' && (
                  <span className="rounded-lg bg-red-50 px-2.5 py-1 font-semibold text-red-600 ring-1 ring-red-100">Cancelled</span>
                )}
              </div>
              <p className="mt-4 text-xs font-semibold text-slate-400">Diagnosis / chief complaint</p>
              <h2 className="mt-1 text-2xl font-semibold leading-tight text-[var(--color-navy)]">{primaryProblem}</h2>
              {visit.diagnosis && visit.complaint && (
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Complaint: {visit.complaint}
                  {visit.complaintDurationDays ? ` (${visit.complaintDurationDays} days)` : ''}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-px border-t border-slate-200 bg-slate-200 lg:border-l lg:border-t-0">
              <SummaryMetric label="Date" value={formattedVisitDate} />
              <SummaryMetric label="Medicines" value={visit.prescription ? visit.prescription.itemCount : 0} />
              <SummaryMetric label="Lab tests" value={visit.labTests.length} />
              <SummaryMetric label="Follow-up" value={followUpLabel ? 'Planned' : 'None'} />
            </div>
          </div>
        </div>

        <VisitSection title="Treatment given" icon={<Pill className="h-4 w-4" />}>
          {prescriptionLoading ? (
            <InlineSkeleton className="h-10 w-full" />
          ) : prescription && prescription.items.length > 0 ? (
            <div className="flex flex-col gap-2">
              {prescription.items.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {item.medicineName}
                      {item.strength ? ` (${item.strength})` : ''}
                    </p>
                    <span className="rounded-lg bg-white px-2 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
                      {item.durationDays} days
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs font-medium text-slate-500">
                    M-{item.morning} | A-{item.afternoon} | E-{item.evening} | N-{item.night} | {foodTimingLabel(item.beforeAfterFood)}
                    {item.instruction ? ` | ${item.instruction}` : ''}
                  </p>
                </div>
              ))}
              {prescription.generalInstruction && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 ring-1 ring-amber-100">
                  Note: {prescription.generalInstruction}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No medicines prescribed.</p>
          )}
        </VisitSection>

        {vitalTiles.length > 0 && (
          <VisitSection title="Important vitals" icon={<Activity className="h-4 w-4" />}>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
              {vitalTiles.map((tile) => (
                <div key={tile.label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <p className="text-xs font-semibold text-slate-400">{tile.label}</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{tile.value}</p>
                </div>
              ))}
            </div>
          </VisitSection>
        )}

        {(visit.labTests.length > 0 || visit.testsAdvised) && (
          <VisitSection title="Tests / results" icon={<FlaskConical className="h-4 w-4" />}>
            {visit.labTests.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {visit.labTests.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    <span className="font-medium text-slate-700">{t.testName}</span>
                    <span className={t.status === 'DONE' ? 'font-semibold text-emerald-600' : 'font-semibold text-amber-600'}>
                      {t.status === 'DONE' && t.resultValue ? `${t.resultValue}${t.resultUnit ?? ''}` : t.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm leading-6 text-slate-700">{visit.testsAdvised}</p>
            )}
          </VisitSection>
        )}

        {(visit.advice || visit.remark || followUpLabel) && (
          <div className="grid gap-4 lg:grid-cols-2">
            {(visit.advice || visit.remark) && (
              <VisitSection title="Advice / notes" icon={<StickyNote className="h-4 w-4" />}>
                {visit.advice && <p className="text-sm leading-6 text-slate-700">{visit.advice}</p>}
                {visit.remark && <p className="mt-1 text-sm leading-6 text-slate-500">{visit.remark}</p>}
              </VisitSection>
            )}
            {followUpLabel && (
              <VisitSection title="Follow-up" icon={<CalendarClock className="h-4 w-4" />}>
                <p className="text-sm font-medium text-slate-700">{followUpLabel}</p>
              </VisitSection>
            )}
          </div>
        )}

        {(visit.examination || (visit.complaint && !visit.diagnosis)) && (
          <div className="grid gap-4 lg:grid-cols-2">
            {visit.examination && (
              <VisitSection title="Examination details" icon={<ClipboardList className="h-4 w-4" />}>
                <p className="text-sm leading-6 text-slate-700">{visit.examination}</p>
              </VisitSection>
            )}
            {visit.complaint && !visit.diagnosis && (
              <VisitSection title="Complaint details" icon={<Stethoscope className="h-4 w-4" />}>
                <p className="text-sm leading-6 text-slate-700">
                  {visit.complaint}
                  {visit.complaintDurationDays ? ` (${visit.complaintDurationDays} days)` : ''}
                </p>
              </VisitSection>
            )}
          </div>
        )}

        {visitDocuments.length > 0 && (
          <VisitSection title="Attachments" icon={<Paperclip className="h-4 w-4" />}>
            <div className="grid gap-2 sm:grid-cols-2">
              {visitDocuments.map((doc) => (
                <a
                  key={doc.id}
                  href={resolveServerUrl(doc.filePath)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-[var(--color-primary)] transition hover:border-[var(--color-primary)] hover:bg-white"
                >
                  <FileText className="h-3.5 w-3.5" /> {doc.fileName}
                </a>
              ))}
            </div>
          </VisitSection>
        )}
      </div>
    </FormModal>
  );
}
