import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';
import { Ban, Download, Eye, Plus, Printer, Search } from 'lucide-react';
import type { CertificateDetail, CertificateType, PatientSearchResult } from '@clinic-care/shared-types';
import { CERTIFICATE_TYPES } from '@clinic-care/shared-types';
import { DataTable } from '@/components/DataTable';
import { FormModal } from '@/components/FormModal';
import { PrintLayout } from '@/components/PrintLayout';
import { TableSkeleton } from '@/components/Skeleton';
import { formLabelClass, standardFieldInputClass } from '@/components/uiStyles';
import { usePatientSearchQuery } from '@/hooks/usePatients';
import { usePatientVisitsQuery } from '@/hooks/useVisits';
import { useClinicQuery } from '@/hooks/useClinic';
import { useCertificateMutations, useCertificatesQuery } from '@/hooks/useCertificates';
import { downloadCsv } from '@/lib/csv';
import { getErrorMessage } from '@/lib/utils';

const TYPE_LABELS: Record<CertificateType, string> = {
  FITNESS: 'Fitness',
  SICK_LEAVE: 'Sick Leave',
  MEDICAL: 'Medical',
  REFERRAL: 'Referral',
  VACCINATION: 'Vaccination',
  CUSTOM: 'Custom',
};

const inputClass = standardFieldInputClass;
const labelClass = formLabelClass;

function fmtDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('en-IN') : '____';
}

function daysBetween(from?: string, to?: string): number | null {
  if (!from || !to) return null;
  const days = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1;
  return days > 0 ? days : null;
}

/** Starter wording per type — always fully editable before saving; the exact words are
 * legally significant, so nothing here is ever re-derived once the doctor has edited it. */
function defaultBodyText(params: {
  type: CertificateType;
  patientName: string;
  age: number;
  gender: string;
  diagnosis: string;
  fromDate: string;
  toDate: string;
}): string {
  const { type, patientName, age, gender, diagnosis, fromDate, toDate } = params;
  const genderWord = gender === 'MALE' ? 'Male' : gender === 'FEMALE' ? 'Female' : 'Other';
  const period = fromDate && toDate ? ` from ${fmtDate(fromDate)} to ${fmtDate(toDate)}` : '';
  const days = daysBetween(fromDate, toDate);
  const today = fmtDate(new Date().toISOString());

  switch (type) {
    case 'FITNESS':
      return `This is to certify that ${patientName}, ${age} years, ${genderWord}, was examined by me on ${today} and is found medically FIT to resume duty/studies.`;
    case 'SICK_LEAVE':
      return `This is to certify that ${patientName}, ${age} years, ${genderWord}, was under my treatment for ${diagnosis || '____'}${period}${days ? ` (${days} days)` : ''} and was advised rest during this period.`;
    case 'MEDICAL':
      return `This is to certify that ${patientName}, ${age} years, ${genderWord}, was under my treatment for ${diagnosis || '____'}${period}.`;
    case 'REFERRAL':
      return `${patientName}, ${age} years, ${genderWord}, is being referred for further evaluation and management${diagnosis ? ` of ${diagnosis}` : ''}. Kindly assess and manage accordingly.`;
    case 'VACCINATION':
      return `This is to certify that ${patientName}, ${age} years, ${genderWord}, was administered the vaccination as advised on ${today}.`;
    case 'CUSTOM':
      return '';
  }
}

function CertificateBody({ certificateNo, issueDate, bodyText }: { certificateNo: string; issueDate: string; bodyText: string }) {
  return (
    <div>
      <div className="flex items-start justify-between text-xs text-gray-500">
        <span>Certificate No: {certificateNo}</span>
        <span>Date: {fmtDate(issueDate)}</span>
      </div>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{bodyText}</p>
    </div>
  );
}

function IssueCertificateModal({
  open,
  onClose,
  onIssued,
}: {
  open: boolean;
  onClose: () => void;
  onIssued: (cert: CertificateDetail, print: boolean) => void;
}) {
  const { issue } = useCertificateMutations();
  const { data: clinic } = useClinicQuery();

  const [search, setSearch] = useState('');
  const { data: results = [] } = usePatientSearchQuery(search);
  const [patient, setPatient] = useState<PatientSearchResult | null>(null);
  const { data: visits } = usePatientVisitsQuery(patient?.id);

  const [type, setType] = useState<CertificateType>('FITNESS');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [bodyTouched, setBodyTouched] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const lastVisit = visits?.[0];

  const reset = () => {
    setSearch('');
    setPatient(null);
    setType('FITNESS');
    setFromDate('');
    setToDate('');
    setDiagnosis('');
    setBodyText('');
    setBodyTouched(false);
    setPreviewOpen(false);
  };

  // Prefill diagnosis from the patient's most recent visit once, right after picking them.
  useEffect(() => {
    if (patient && lastVisit?.diagnosis) {
      setDiagnosis(lastVisit.diagnosis);
    }
  }, [patient, lastVisit]);

  // Regenerate the template on every relevant change, unless the doctor has started
  // editing the body text themselves — never overwrite their edits.
  useEffect(() => {
    if (!patient || bodyTouched) return;
    setBodyText(
      defaultBodyText({ type, patientName: patient.name, age: patient.age, gender: patient.gender, diagnosis, fromDate, toDate }),
    );
  }, [patient, type, diagnosis, fromDate, toDate, bodyTouched]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const submit = async (andPrint: boolean) => {
    if (!patient || !bodyText.trim()) {
      toast.error('Pick a patient and fill in the certificate body.');
      return;
    }
    try {
      const cert = await issue.mutateAsync({
        patientId: patient.id,
        visitId: lastVisit?.id,
        type,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        diagnosis: diagnosis || undefined,
        bodyText,
      });
      toast.success(`Certificate ${cert.certificateNo} issued`);
      onIssued(cert, andPrint);
      handleClose();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not issue certificate.'));
    }
  };

  return (
    <FormModal open={open} title="Issue Certificate" size="lg" onClose={handleClose}>
      <div className="flex flex-col gap-4">
        {!patient ? (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patient by mobile or name"
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            />
            {results.length > 0 && (
              <div className="mt-2 overflow-hidden rounded-lg border border-gray-200">
                {results.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPatient(p)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    <span>
                      {p.name} <span className="text-gray-400">· {p.age}/{p.gender.charAt(0)}</span>
                    </span>
                    <span className="text-gray-400">{p.mobile}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
              <p className="text-sm">
                <span className="font-medium text-gray-800">{patient.name}</span>{' '}
                <span className="text-gray-500">
                  · {patient.age}/{patient.gender.charAt(0)} · {patient.mobile}
                </span>
              </p>
              <button onClick={() => setPatient(null)} className="text-xs font-medium text-[var(--color-primary)]">
                Change
              </button>
            </div>

            <div>
              <label className={labelClass}>Certificate type</label>
              <div className="flex flex-wrap gap-2">
                {CERTIFICATE_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                      type === t ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white' : 'border-gray-300 text-gray-600'
                    }`}
                  >
                    {TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Diagnosis</label>
                <input value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>From</label>
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>To</label>
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={inputClass} />
              </div>
            </div>

            <div>
              <label className={labelClass}>Certificate text (edit as needed)</label>
              <textarea
                rows={6}
                value={bodyText}
                onChange={(e) => {
                  setBodyText(e.target.value);
                  setBodyTouched(true);
                }}
                className={inputClass}
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setPreviewOpen(true)}
                disabled={!bodyText.trim()}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                <Eye className="h-4 w-4" /> Preview
              </button>
              <button
                onClick={() => submit(false)}
                disabled={issue.isPending}
                className="rounded-lg border border-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-teal-50 disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => submit(true)}
                disabled={issue.isPending}
                className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                Save & Print
              </button>
            </div>
          </>
        )}
      </div>

      {clinic && patient && (
        <FormModal open={previewOpen} title="Certificate Preview" size="lg" onClose={() => setPreviewOpen(false)}>
          <PrintLayout
            clinic={clinic}
            documentTitle={`${TYPE_LABELS[type]} Certificate`}
            onPrint={() => {
              setPreviewOpen(false);
              submit(true);
            }}
          >
            <CertificateBody certificateNo="(assigned on save)" issueDate={new Date().toISOString()} bodyText={bodyText} />
          </PrintLayout>
        </FormModal>
      )}
    </FormModal>
  );
}

function CancelCertificateModal({
  certificate,
  onClose,
}: {
  certificate: CertificateDetail | null;
  onClose: () => void;
}) {
  const { cancel } = useCertificateMutations();
  const [reason, setReason] = useState('');

  const submit = async () => {
    if (!certificate || !reason.trim()) return;
    try {
      await cancel.mutateAsync({ id: certificate.id, payload: { reason } });
      toast.success('Certificate cancelled');
      setReason('');
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not cancel certificate.'));
    }
  };

  return (
    <FormModal
      open={Boolean(certificate)}
      title={`Cancel Certificate ${certificate?.certificateNo ?? ''}`}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">
            Back
          </button>
          <button
            onClick={submit}
            disabled={!reason.trim() || cancel.isPending}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Cancel Certificate
          </button>
        </>
      }
    >
      <p className="text-sm text-gray-500">
        This certificate stays on record (never deleted) but is marked cancelled. Give a reason.
      </p>
      <textarea
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason for cancellation"
        className={`${inputClass} mt-3`}
      />
    </FormModal>
  );
}

export function CertificatesPage() {
  const { data: certificates, isLoading } = useCertificatesQuery();
  const { data: clinic } = useClinicQuery();
  const { markPrinted } = useCertificateMutations();

  const [issueOpen, setIssueOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<CertificateDetail | null>(null);
  const [printTarget, setPrintTarget] = useState<CertificateDetail | null>(null);
  const [previewTarget, setPreviewTarget] = useState<CertificateDetail | null>(null);

  const handlePrint = async (cert: CertificateDetail) => {
    try {
      const updated = await markPrinted.mutateAsync(cert.id);
      setPrintTarget(updated);
      setTimeout(() => window.print(), 100);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not print certificate.'));
    }
  };

  const handleExport = () => {
    if (!certificates?.length) return;
    downloadCsv(
      `certificates-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Certificate No', 'Patient', 'Mobile', 'Type', 'Issue Date', 'From', 'To', 'Status', 'Issued By'],
      certificates.map((c) => [
        c.certificateNo,
        c.patientName,
        c.patientMobile,
        TYPE_LABELS[c.type],
        c.issueDate,
        c.fromDate ?? '',
        c.toDate ?? '',
        c.status,
        c.issuedBy ?? '',
      ]),
    );
  };

  const columns: ColumnDef<CertificateDetail>[] = [
    { accessorKey: 'certificateNo', header: 'Certificate No' },
    {
      id: 'patient',
      header: 'Patient',
      accessorFn: (row) => `${row.patientName} ${row.patientMobile}`,
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-gray-800">{row.original.patientName}</p>
          <p className="text-xs text-gray-400">{row.original.patientMobile}</p>
        </div>
      ),
    },
    { id: 'type', header: 'Type', cell: ({ row }) => TYPE_LABELS[row.original.type] },
    {
      accessorKey: 'issueDate',
      header: 'Issue Date',
      cell: ({ getValue }) => fmtDate(getValue<string>()),
    },
    {
      id: 'period',
      header: 'Period',
      cell: ({ row }) =>
        row.original.fromDate && row.original.toDate ? `${fmtDate(row.original.fromDate)} – ${fmtDate(row.original.toDate)}` : '—',
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            row.original.status === 'ISSUED' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
          }`}
        >
          {row.original.status === 'ISSUED' ? 'Issued' : 'Cancelled'}
        </span>
      ),
    },
    { accessorKey: 'issuedBy', header: 'Issued By', cell: ({ getValue }) => getValue<string | null>() ?? '—' },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPreviewTarget(row.original)}
            title="View"
            className="rounded-lg border border-gray-300 p-1.5 text-gray-500 hover:bg-gray-50"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => handlePrint(row.original)}
            title="Print / Reprint"
            className="rounded-lg border border-gray-300 p-1.5 text-gray-500 hover:bg-gray-50"
          >
            <Printer className="h-3.5 w-3.5" />
          </button>
          {row.original.status === 'ISSUED' && (
            <button
              onClick={() => setCancelTarget(row.original)}
              title="Cancel"
              className="rounded-lg border border-gray-300 p-1.5 text-red-500 hover:bg-red-50"
            >
              <Ban className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-navy)]">Certificates</h1>
          <p className="text-sm text-gray-500">Fitness, sick leave, medical, referral and vaccination certificates.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            disabled={!certificates?.length}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button
            onClick={() => setIssueOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Issue Certificate
          </button>
        </div>
      </div>

      <div className="no-print">
        {isLoading ? (
          <TableSkeleton rows={6} columns={8} />
        ) : (
          <DataTable columns={columns} data={certificates ?? []} emptyMessage="No certificates issued yet." />
        )}
      </div>

      <IssueCertificateModal
        open={issueOpen}
        onClose={() => setIssueOpen(false)}
        onIssued={(cert, print) => {
          if (print) handlePrint(cert);
        }}
      />
      <CancelCertificateModal certificate={cancelTarget} onClose={() => setCancelTarget(null)} />

      {clinic && previewTarget && (
        <FormModal open onClose={() => setPreviewTarget(null)} title="Certificate Preview" size="lg">
          <PrintLayout
            clinic={clinic}
            documentTitle={`${TYPE_LABELS[previewTarget.type]} Certificate`}
            onPrint={() => {
              handlePrint(previewTarget);
              setPreviewTarget(null);
            }}
          >
            <CertificateBody
              certificateNo={previewTarget.certificateNo}
              issueDate={previewTarget.issueDate}
              bodyText={previewTarget.bodyText}
            />
          </PrintLayout>
        </FormModal>
      )}

      {clinic && printTarget && (
        <div className="hidden print:block">
          <PrintLayout clinic={clinic} documentTitle={`${TYPE_LABELS[printTarget.type]} Certificate`}>
            <CertificateBody certificateNo={printTarget.certificateNo} issueDate={printTarget.issueDate} bodyText={printTarget.bodyText} />
          </PrintLayout>
        </div>
      )}
    </div>
  );
}
