import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Activity,
  AlertCircle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Link2,
  ListOrdered,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Search,
  XCircle,
} from 'lucide-react';
import { GENDERS } from '@clinic-care/shared-types';
import type { AppointmentDetail, AppointmentStatus, Gender } from '@clinic-care/shared-types';
import { FormModal } from '@/components/FormModal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { usePatientMutations, usePatientSearchQuery } from '@/hooks/usePatients';
import {
  useAppointmentMutations,
  useAppointmentQueueQuery,
  useAppointmentSearchQuery,
  useAppointmentsByDayQuery,
  useDoctorsQuery,
} from '@/hooks/useAppointments';
import { useClinicQuery } from '@/hooks/useClinic';
import { useVisitMutations } from '@/hooks/useVisits';
import { useAuthStore } from '@/store/auth-store';
import { hasPermission } from '@/lib/permissions';
import { getErrorMessage, cn } from '@/lib/utils';

const EDITABLE_STATUSES: AppointmentStatus[] = ['BOOKED', 'CONFIRMED'];
// ARRIVED/IN_CONSULTATION already have a live visit in progress and DONE is a completed
// encounter — "reschedule" only makes real front-desk sense for these statuses, even
// though the backend itself allows reviving anything short of DONE.
const RESCHEDULABLE_UI_STATUSES: AppointmentStatus[] = ['BOOKED', 'CONFIRMED', 'NO_SHOW', 'CANCELLED'];
const ACTIVE_STATUSES: AppointmentStatus[] = ['BOOKED', 'CONFIRMED', 'ARRIVED', 'IN_CONSULTATION', 'DONE'];
const CANCELLABLE_STATUSES: AppointmentStatus[] = ['BOOKED', 'CONFIRMED', 'ARRIVED'];
const WAITING_ALERT_MINUTES = 30;

const STATUS_STYLE: Record<AppointmentStatus, string> = {
  BOOKED: 'bg-blue-100 text-blue-700',
  CONFIRMED: 'bg-indigo-100 text-indigo-700',
  ARRIVED: 'bg-amber-100 text-amber-700',
  IN_CONSULTATION: 'bg-purple-100 text-purple-700',
  DONE: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
  NO_SHOW: 'bg-red-100 text-red-700',
};

function waLink(mobile: string, message: string) {
  return `https://wa.me/91${mobile}?text=${encodeURIComponent(message)}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// <input type="time"> gives back 24-hour "HH:mm" — store the friendly label since
// that's what the day list, queue and WhatsApp messages print as-is.
function formatTimeSlot(value: string): string {
  const [hours, minutes] = value.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`;
}

function waitingMinutes(updatedAt: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(updatedAt).getTime()) / 60000));
}

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]';
const labelClass = 'mb-1 block text-sm font-medium text-gray-700';

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
const MINUTES_60 = Array.from({ length: 60 }, (_, i) => i);

function parse24Hour(value: string): { hour12: number; minute: number; period: 'AM' | 'PM' } | null {
  if (!value) return null;
  const [hour, minute] = value.split(':').map(Number);
  return { hour12: hour % 12 || 12, minute, period: hour >= 12 ? 'PM' : 'AM' };
}

function to24Hour(hour12: number, minute: number, period: 'AM' | 'PM'): string {
  const hour = period === 'AM' ? hour12 % 12 : (hour12 % 12) + 12;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** 12-hour AM/PM time picker — native <input type="time"> renders in 24h or 12h
 * depending on OS locale, so it can't be forced to show AM/PM consistently. */
function TimeInput12h({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const parsed = parse24Hour(value);
  const hour12 = parsed?.hour12 ?? '';
  const minute = parsed?.minute ?? 0;
  const period = parsed?.period ?? 'AM';

  const commit = (nextHour: number | '', nextMinute: number, nextPeriod: 'AM' | 'PM') => {
    onChange(nextHour === '' ? '' : to24Hour(nextHour, nextMinute, nextPeriod));
  };

  return (
    <div className="flex gap-1">
      <select
        value={hour12}
        onChange={(e) => commit(e.target.value ? Number(e.target.value) : '', minute, period)}
        className={inputClass}
      >
        <option value="">--</option>
        {HOURS_12.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <select
        value={minute}
        onChange={(e) => commit(hour12, Number(e.target.value), period)}
        disabled={hour12 === ''}
        className={inputClass}
      >
        {MINUTES_60.map((m) => (
          <option key={m} value={m}>
            {String(m).padStart(2, '0')}
          </option>
        ))}
      </select>
      <select
        value={period}
        onChange={(e) => commit(hour12, minute, e.target.value as 'AM' | 'PM')}
        disabled={hour12 === ''}
        className={inputClass}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}

/** "HH:mm" from openTime to closeTime, stepped by slotMinutes — all clinic-configurable
 * (Settings > Clinic Profile > Scheduling), so a clinic that runs a 10-min-per-patient
 * shift doesn't get stuck with 15-min slots baked into the UI. */
function generateSlots(openTime: string, closeTime: string, slotMinutes: number): string[] {
  const [openH, openM] = openTime.split(':').map(Number);
  const [closeH, closeM] = closeTime.split(':').map(Number);
  const start = openH * 60 + openM;
  const end = closeH * 60 + closeM;
  const slots: string[] = [];
  for (let t = start; t < end; t += slotMinutes) {
    slots.push(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);
  }
  return slots;
}

/** Visual day-at-a-glance slot grid: red = booked (hover/tap for who), white = open,
 * primary = currently selected. Clicking an open slot fills the time picker directly —
 * this is the fix for "no clear idea which slot is booked, complete guessing". */
function SlotGrid({
  appointments,
  excludeId,
  value,
  onSelect,
  doctorId,
}: {
  appointments?: AppointmentDetail[];
  excludeId?: string;
  value: string;
  onSelect: (time24: string) => void;
  /** Same doctor bucket as the form's doctor field — a slot is only "taken" against the
   * same doctor (or, if no doctor is picked, the shared no-doctor queue). Two different
   * doctors can hold the same time without conflicting. */
  doctorId: string;
}) {
  const { data: clinic } = useClinicQuery();

  if (!clinic) return null;

  const bookedByLabel = new Map<string, AppointmentDetail>();
  for (const a of appointments ?? []) {
    if (a.id !== excludeId && (a.doctorId ?? '') === doctorId && ACTIVE_STATUSES.includes(a.status)) {
      bookedByLabel.set(a.timeSlot, a);
    }
  }
  const slots = generateSlots(clinic.openTime, clinic.closeTime, clinic.slotMinutes);
  const bookedCount = bookedByLabel.size;

  return (
    <div>
      <p className="mb-1 text-xs font-medium text-gray-500">
        {bookedCount > 0 ? `${bookedCount} already booked today — tap an open slot` : 'No appointments yet today — tap a slot'}
      </p>
      <div className="grid max-h-40 grid-cols-4 gap-1.5 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-2 sm:grid-cols-6">
        {slots.map((time24) => {
          const label = formatTimeSlot(time24);
          const booked = bookedByLabel.get(label);
          const isSelected = value === time24;
          return (
            <button
              key={time24}
              type="button"
              onClick={() => !booked && onSelect(time24)}
              disabled={Boolean(booked)}
              title={booked ? `${booked.patientName} · token #${booked.tokenNo}` : 'Available'}
              className={cn(
                'rounded-md px-1 py-1 text-[11px] font-medium transition-colors',
                booked
                  ? 'cursor-not-allowed bg-red-100 text-red-700'
                  : isSelected
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'border border-gray-200 bg-white text-gray-600 hover:border-[var(--color-primary)]',
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-3 text-[11px] text-gray-400">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-red-200" /> Booked
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full border border-gray-300 bg-white" /> Open
        </span>
      </div>
    </div>
  );
}

function DoctorSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { data: doctors = [] } = useDoctorsQuery();
  return (
    <div>
      <label className={labelClass}>Doctor (optional)</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        <option value="">No doctor assigned</option>
        {doctors.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Generic "type why" prompt — used for cancel and no-show, both of which require a reason. */
function ReasonPromptModal({
  open,
  title,
  onClose,
  onSubmit,
  isPending,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  isPending: boolean;
}) {
  const [reason, setReason] = useState('');

  return (
    <FormModal
      open={open}
      title={title}
      size="sm"
      onClose={() => {
        setReason('');
        onClose();
      }}
      footer={
        <>
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">
            Back
          </button>
          <button
            onClick={() => {
              onSubmit(reason);
              setReason('');
            }}
            disabled={!reason.trim() || isPending}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Confirm
          </button>
        </>
      }
    >
      <label className={labelClass}>Reason</label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        autoFocus
        className={inputClass}
      />
    </FormModal>
  );
}

function BookAppointmentModal({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  const { book } = useAppointmentMutations();
  const { data: dayAppointments } = useAppointmentsByDayQuery(date);
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [search, setSearch] = useState('');
  const [patientId, setPatientId] = useState<string | undefined>();
  const [patientName, setPatientName] = useState('');
  const [mobile, setMobile] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [purpose, setPurpose] = useState('');
  const [conflictLabel, setConflictLabel] = useState<string | null>(null);

  const { data: results = [] } = usePatientSearchQuery(mode === 'existing' ? search : '');

  const reset = () => {
    setMode('existing');
    setSearch('');
    setPatientId(undefined);
    setPatientName('');
    setMobile('');
    setTimeSlot('');
    setDoctorId('');
    setPurpose('');
  };

  const doBook = async () => {
    try {
      const result = await book.mutateAsync({
        patientId,
        patientName,
        mobile,
        appointmentDate: date,
        timeSlot: formatTimeSlot(timeSlot),
        doctorId: doctorId || undefined,
        purpose: purpose || undefined,
        source: 'WALK_IN',
      });
      toast.success(`Appointment booked — token #${result.appointment.tokenNo}`);
      reset();
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not book appointment.'));
    } finally {
      setConflictLabel(null);
    }
  };

  const onSave = () => {
    if (!patientName || !mobile || !timeSlot) {
      toast.error('Name, mobile and time slot are required.');
      return;
    }
    const label = formatTimeSlot(timeSlot);
    const slotConflict = dayAppointments?.find(
      (a) => a.timeSlot === label && (a.doctorId ?? '') === doctorId && ACTIVE_STATUSES.includes(a.status),
    );
    if (slotConflict) {
      setConflictLabel(`${label} is already booked for ${slotConflict.patientName} (token #${slotConflict.tokenNo}).`);
      return;
    }
    const patientConflict =
      patientId && dayAppointments?.find((a) => a.patientId === patientId && ACTIVE_STATUSES.includes(a.status));
    if (patientConflict) {
      setConflictLabel(`${patientName} already has an appointment today at ${patientConflict.timeSlot} (token #${patientConflict.tokenNo}).`);
      return;
    }
    doBook();
  };

  return (
    <>
    <FormModal
      open={open}
      title="Book Appointment"
      onClose={() => {
        reset();
        onClose();
      }}
      footer={
        <>
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={book.isPending}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {book.isPending ? 'Booking...' : 'Book'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex gap-1 rounded-lg border border-gray-200 p-1">
          <button
            onClick={() => setMode('existing')}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium ${mode === 'existing' ? 'bg-[var(--color-primary)] text-white' : 'text-gray-600'}`}
          >
            Existing Patient
          </button>
          <button
            onClick={() => setMode('new')}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium ${mode === 'new' ? 'bg-[var(--color-primary)] text-white' : 'text-gray-600'}`}
          >
            New Caller
          </button>
        </div>

        {mode === 'existing' ? (
          <div className="relative">
            <label className={labelClass}>Search patient</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Mobile or name"
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </div>
            {search && results.length > 0 && !patientId && (
              <div className="mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                {results.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setPatientId(p.id);
                      setPatientName(p.name);
                      setMobile(p.mobile);
                      setSearch(p.name);
                    }}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    <span>{p.name}</span>
                    <span className="text-gray-400">{p.mobile}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Name</label>
              <input value={patientName} onChange={(e) => setPatientName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Mobile</label>
              <input value={mobile} onChange={(e) => setMobile(e.target.value)} maxLength={10} className={inputClass} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Time</label>
            <TimeInput12h value={timeSlot} onChange={setTimeSlot} />
          </div>
          <DoctorSelect value={doctorId} onChange={setDoctorId} />
        </div>
        <div>
          <label className={labelClass}>Purpose (optional)</label>
          <input value={purpose} onChange={(e) => setPurpose(e.target.value)} className={inputClass} />
        </div>
        <SlotGrid appointments={dayAppointments} value={timeSlot} onSelect={setTimeSlot} doctorId={doctorId} />
      </div>
    </FormModal>

    <ConfirmDialog
      open={Boolean(conflictLabel)}
      title="Possible conflict"
      description={`${conflictLabel} Book this appointment anyway, or go back and change it?`}
      confirmLabel="Book Anyway"
      cancelLabel="Change"
      onConfirm={doBook}
      onCancel={() => setConflictLabel(null)}
    />
    </>
  );
}

function LinkPatientModal({ open, onClose, appointment }: { open: boolean; onClose: () => void; appointment: AppointmentDetail }) {
  const { linkPatient } = useAppointmentMutations();
  const { create: createPatient } = usePatientMutations();
  const [mode, setMode] = useState<'search' | 'new'>('search');
  const [search, setSearch] = useState('');
  const { data: results = [] } = usePatientSearchQuery(search);

  const [name, setName] = useState(appointment.patientName);
  const [mobile, setMobile] = useState(appointment.mobile);
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender>('MALE');

  const reset = () => {
    setMode('search');
    setSearch('');
    setName(appointment.patientName);
    setMobile(appointment.mobile);
    setAge('');
    setGender('MALE');
  };

  const onLink = async (patientId: string) => {
    try {
      await linkPatient.mutateAsync({ id: appointment.id, patientId });
      toast.success('Appointment linked to patient');
      reset();
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not link patient.'));
    }
  };

  const onRegisterAndLink = async () => {
    if (!name || !mobile || !age) {
      toast.error('Name, mobile and age are required.');
      return;
    }
    try {
      const { patient } = await createPatient.mutateAsync({
        name,
        mobile,
        age: Number(age),
        gender,
        address: 'Not provided',
        chronicDiseases: 'Not recorded',
        stage: 'New',
      });
      await onLink(patient.id);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not register patient.'));
    }
  };

  const isPending = linkPatient.isPending || createPatient.isPending;

  return (
    <FormModal
      open={open}
      title={`Link "${appointment.patientName}" to a patient record`}
      size="sm"
      onClose={() => {
        reset();
        onClose();
      }}
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-gray-500">
          This appointment was booked for a new caller. Link it to an existing patient, or register them now if this is
          their first visit — either way "Arrived" can then start a visit.
        </p>

        <div className="flex gap-1 rounded-lg border border-gray-200 p-1">
          <button
            onClick={() => setMode('search')}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium ${mode === 'search' ? 'bg-[var(--color-primary)] text-white' : 'text-gray-600'}`}
          >
            Existing Patient
          </button>
          <button
            onClick={() => setMode('new')}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium ${mode === 'new' ? 'bg-[var(--color-primary)] text-white' : 'text-gray-600'}`}
          >
            First Visit
          </button>
        </div>

        {mode === 'search' ? (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by mobile or name"
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </div>
            {results.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-gray-200">
                {results.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onLink(p.id)}
                    disabled={isPending}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50"
                  >
                    <span>{p.name}</span>
                    <span className="text-gray-400">{p.mobile}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Mobile</label>
                <input value={mobile} onChange={(e) => setMobile(e.target.value)} maxLength={10} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Age</label>
                <input type="number" min={0} value={age} onChange={(e) => setAge(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Gender</label>
                <select value={gender} onChange={(e) => setGender(e.target.value as Gender)} className={inputClass}>
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={onRegisterAndLink}
              disabled={isPending}
              className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? 'Registering...' : 'Register & Link'}
            </button>
          </>
        )}
      </div>
    </FormModal>
  );
}

function EditAppointmentModal({ open, onClose, appointment }: { open: boolean; onClose: () => void; appointment: AppointmentDetail }) {
  const { update } = useAppointmentMutations();
  const [patientName, setPatientName] = useState(appointment.patientName);
  const [mobile, setMobile] = useState(appointment.mobile);
  const [doctorId, setDoctorId] = useState(appointment.doctorId ?? '');
  const [purpose, setPurpose] = useState(appointment.purpose ?? '');

  const onSave = async () => {
    try {
      await update.mutateAsync({
        id: appointment.id,
        payload: { patientName, mobile, doctorId, purpose: purpose || undefined, expectedUpdatedAt: appointment.updatedAt },
      });
      toast.success('Appointment updated');
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not update appointment.'));
    }
  };

  return (
    <FormModal
      open={open}
      title={`Edit — Token #${appointment.tokenNo}`}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={update.isPending}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Save
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs text-gray-400">
          To change the date or time, use Reschedule instead — Edit only changes the details below.
        </p>
        <div>
          <label className={labelClass}>Name</label>
          <input value={patientName} onChange={(e) => setPatientName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Mobile</label>
          <input value={mobile} onChange={(e) => setMobile(e.target.value)} maxLength={10} className={inputClass} />
        </div>
        <DoctorSelect value={doctorId} onChange={setDoctorId} />
        <div>
          <label className={labelClass}>Purpose</label>
          <input value={purpose} onChange={(e) => setPurpose(e.target.value)} className={inputClass} />
        </div>
      </div>
    </FormModal>
  );
}

function RescheduleAppointmentModal({ open, onClose, appointment }: { open: boolean; onClose: () => void; appointment: AppointmentDetail }) {
  const { reschedule } = useAppointmentMutations();
  const [newDate, setNewDate] = useState(appointment.appointmentDate.slice(0, 10));
  const [newTimeSlot, setNewTimeSlot] = useState('');
  const [conflictLabel, setConflictLabel] = useState<string | null>(null);
  const { data: targetDayAppointments } = useAppointmentsByDayQuery(newDate);

  const doReschedule = async () => {
    try {
      const result = await reschedule.mutateAsync({
        id: appointment.id,
        payload: {
          newDate,
          newTimeSlot: newTimeSlot ? formatTimeSlot(newTimeSlot) : undefined,
          expectedUpdatedAt: appointment.updatedAt,
        },
      });
      toast.success(`Rescheduled to ${new Date(newDate).toLocaleDateString('en-IN')} — token #${result.appointment.tokenNo}`);
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not reschedule appointment.'));
    } finally {
      setConflictLabel(null);
    }
  };

  const onSave = () => {
    const label = newTimeSlot ? formatTimeSlot(newTimeSlot) : appointment.timeSlot;
    const slotConflict = targetDayAppointments?.find(
      (a) =>
        a.id !== appointment.id &&
        a.timeSlot === label &&
        (a.doctorId ?? '') === (appointment.doctorId ?? '') &&
        ACTIVE_STATUSES.includes(a.status),
    );
    if (slotConflict) {
      setConflictLabel(`${label} on ${new Date(newDate).toLocaleDateString('en-IN')} is already booked for ${slotConflict.patientName} (token #${slotConflict.tokenNo}).`);
      return;
    }
    const patientConflict =
      appointment.patientId &&
      targetDayAppointments?.find(
        (a) => a.id !== appointment.id && a.patientId === appointment.patientId && ACTIVE_STATUSES.includes(a.status),
      );
    if (patientConflict) {
      setConflictLabel(`${appointment.patientName} already has an appointment on that day at ${patientConflict.timeSlot} (token #${patientConflict.tokenNo}).`);
      return;
    }
    doReschedule();
  };

  return (
    <>
    <FormModal
      open={open}
      title={`Reschedule — ${appointment.patientName}`}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={reschedule.isPending}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Save
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs text-gray-400">Currently: {new Date(appointment.appointmentDate).toLocaleDateString('en-IN')} at {appointment.timeSlot}</p>
        <div>
          <label className={labelClass}>New date</label>
          <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>New time (optional — keeps current time if left blank)</label>
          <TimeInput12h value={newTimeSlot} onChange={setNewTimeSlot} />
        </div>
        <SlotGrid
          appointments={targetDayAppointments}
          excludeId={appointment.id}
          value={newTimeSlot}
          onSelect={setNewTimeSlot}
          doctorId={appointment.doctorId ?? ''}
        />
      </div>
    </FormModal>

    <ConfirmDialog
      open={Boolean(conflictLabel)}
      title="Possible conflict"
      description={`${conflictLabel} Reschedule here anyway, or go back and change it?`}
      confirmLabel="Reschedule Anyway"
      cancelLabel="Change"
      onConfirm={doReschedule}
      onCancel={() => setConflictLabel(null)}
    />
    </>
  );
}

interface AppointmentActionsProps {
  appointment: AppointmentDetail;
  onEdit: (a: AppointmentDetail) => void;
  onLink: (a: AppointmentDetail) => void;
  onReschedule: (a: AppointmentDetail) => void;
  onConfirm: (a: AppointmentDetail) => void;
  onCancel: (a: AppointmentDetail) => void;
}

function AppointmentActions({ appointment: a, onEdit, onLink, onReschedule, onConfirm, onCancel }: AppointmentActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {a.status === 'BOOKED' && (
        <button
          onClick={() => onConfirm(a)}
          className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> Confirm
        </button>
      )}
      {EDITABLE_STATUSES.includes(a.status) && (
        <button
          onClick={() => onEdit(a)}
          className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          <Pencil className="h-3.5 w-3.5" /> Edit
        </button>
      )}
      {!a.patientId && (
        <button
          onClick={() => onLink(a)}
          className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          <Link2 className="h-3.5 w-3.5" /> Link Patient
        </button>
      )}
      {RESCHEDULABLE_UI_STATUSES.includes(a.status) && (
        <button
          onClick={() => onReschedule(a)}
          className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          <CalendarClock className="h-3.5 w-3.5" /> Reschedule
        </button>
      )}
      {CANCELLABLE_STATUSES.includes(a.status) && (
        <button
          onClick={() => onCancel(a)}
          className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
        >
          <XCircle className="h-3.5 w-3.5" /> Cancel
        </button>
      )}
    </div>
  );
}

function AppointmentSearchBox({ onJumpToDate }: { onJumpToDate: (date: string) => void }) {
  const [query, setQuery] = useState('');
  const { data: results = [] } = useAppointmentSearchQuery(query);

  return (
    <div className="relative w-72">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Find an appointment (any date)..."
        className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
      />
      {query && results.length > 0 && (
        <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          {results.map((a) => (
            <button
              key={a.id}
              onClick={() => {
                onJumpToDate(a.appointmentDate.slice(0, 10));
                setQuery('');
              }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50"
            >
              <span>
                {a.patientName} <span className="text-gray-400">· {a.mobile}</span>
              </span>
              <span className="text-xs text-gray-400">
                {new Date(a.appointmentDate).toLocaleDateString('en-IN')} · {a.timeSlot}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DayView({ date, onDateChange }: { date: string; onDateChange: (date: string) => void }) {
  const [bookOpen, setBookOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AppointmentDetail | null>(null);
  const [linkTarget, setLinkTarget] = useState<AppointmentDetail | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentDetail | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AppointmentDetail | null>(null);
  const { data: appointments, isLoading } = useAppointmentsByDayQuery(date);
  const { updateStatus } = useAppointmentMutations();

  const onConfirm = async (a: AppointmentDetail) => {
    try {
      await updateStatus.mutateAsync({ id: a.id, status: 'CONFIRMED' });
      toast.success(`${a.patientName} confirmed`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not confirm appointment.'));
    }
  };

  const onCancelSubmit = async (reason: string) => {
    if (!cancelTarget) return;
    try {
      await updateStatus.mutateAsync({ id: cancelTarget.id, status: 'CANCELLED', reason });
      toast.success(`${cancelTarget.patientName}'s appointment cancelled`);
      setCancelTarget(null);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not cancel appointment.'));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <input type="date" value={date} onChange={(e) => onDateChange(e.target.value)} className={`${inputClass} w-auto`} />
        <button
          onClick={() => setBookOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Book Appointment
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : !appointments || appointments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <CalendarDays className="h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm text-gray-400">No appointments booked for this day.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Token</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Doctor</th>
                <th className="px-4 py-3">Purpose</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {appointments.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3">#{a.tokenNo}</td>
                  <td className="px-4 py-3">{a.timeSlot}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{a.patientName}</p>
                    <p className="text-xs text-gray-400">{a.mobile}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{a.doctorName ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{a.purpose ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[a.status]}`}>
                      {a.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <AppointmentActions
                      appointment={a}
                      onEdit={setEditTarget}
                      onLink={setLinkTarget}
                      onReschedule={setRescheduleTarget}
                      onConfirm={onConfirm}
                      onCancel={setCancelTarget}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <BookAppointmentModal open={bookOpen} onClose={() => setBookOpen(false)} date={date} />
      {editTarget && (
        <EditAppointmentModal open={Boolean(editTarget)} onClose={() => setEditTarget(null)} appointment={editTarget} />
      )}
      {linkTarget && (
        <LinkPatientModal open={Boolean(linkTarget)} onClose={() => setLinkTarget(null)} appointment={linkTarget} />
      )}
      {rescheduleTarget && (
        <RescheduleAppointmentModal
          open={Boolean(rescheduleTarget)}
          onClose={() => setRescheduleTarget(null)}
          appointment={rescheduleTarget}
        />
      )}
      <ReasonPromptModal
        open={Boolean(cancelTarget)}
        title={`Cancel ${cancelTarget?.patientName}'s appointment?`}
        onClose={() => setCancelTarget(null)}
        onSubmit={onCancelSubmit}
        isPending={updateStatus.isPending}
      />
    </div>
  );
}

/** Nurse/reception vitals capture — happens after "Arrived" but before the doctor opens
 * the consultation, so weight/BP/etc. don't get relayed to the doctor secondhand. Posts
 * to the same /visits/:id/vitals endpoint the consultation screen uses (upsert, so
 * whoever saves last wins — the doctor can still correct it there). */
function VitalsModal({ open, onClose, appointment }: { open: boolean; onClose: () => void; appointment: AppointmentDetail }) {
  const { saveVitals } = useVisitMutations();
  const [bp, setBp] = useState('');
  const [pulse, setPulse] = useState('');
  const [temperature, setTemperature] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [spo2, setSpo2] = useState('');
  const [notes, setNotes] = useState('');

  const reset = () => {
    setBp('');
    setPulse('');
    setTemperature('');
    setWeight('');
    setHeight('');
    setSpo2('');
    setNotes('');
  };

  const onSave = async () => {
    if (!appointment.visitId) return;
    try {
      await saveVitals.mutateAsync({
        id: appointment.visitId,
        payload: {
          bp: bp || undefined,
          pulse: pulse ? Number(pulse) : undefined,
          temperature: temperature ? Number(temperature) : undefined,
          weight: weight ? Number(weight) : undefined,
          height: height ? Number(height) : undefined,
          spo2: spo2 ? Number(spo2) : undefined,
          notes: notes || undefined,
        },
      });
      toast.success(`Vitals recorded for ${appointment.patientName}`);
      reset();
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not save vitals.'));
    }
  };

  return (
    <FormModal
      open={open}
      title={`Record Vitals — ${appointment.patientName}`}
      size="sm"
      onClose={() => {
        reset();
        onClose();
      }}
      footer={
        <>
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saveVitals.isPending}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saveVitals.isPending ? 'Saving...' : 'Save Vitals'}
          </button>
        </>
      }
    >
      <p className="mb-3 text-xs text-gray-400">
        Recorded before the doctor sees the patient — shown on the consultation screen.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>BP</label>
          <input value={bp} onChange={(e) => setBp(e.target.value)} placeholder="120/80" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Pulse</label>
          <input type="number" value={pulse} onChange={(e) => setPulse(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Temperature (°C)</label>
          <input type="number" step="0.1" value={temperature} onChange={(e) => setTemperature(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Weight (kg)</label>
          <input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Height (cm)</label>
          <input type="number" step="0.1" value={height} onChange={(e) => setHeight(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>SpO2 (%)</label>
          <input type="number" value={spo2} onChange={(e) => setSpo2(e.target.value)} className={inputClass} />
        </div>
        <div className="col-span-2">
          <label className={labelClass}>Notes</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
        </div>
      </div>
    </FormModal>
  );
}

function QueueView() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.user);
  const { data: clinic } = useClinicQuery();
  const { data: queue, isLoading } = useAppointmentQueueQuery();
  const { updateStatus, markArrived } = useAppointmentMutations();
  const [linkTarget, setLinkTarget] = useState<AppointmentDetail | null>(null);
  const [noShowTarget, setNoShowTarget] = useState<AppointmentDetail | null>(null);
  const [vitalsTarget, setVitalsTarget] = useState<AppointmentDetail | null>(null);

  const onArrived = async (appointment: AppointmentDetail) => {
    try {
      await markArrived.mutateAsync(appointment.id);
      toast.success(`${appointment.patientName} marked arrived`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not mark arrived.'));
    }
  };

  const onStart = async (appointment: AppointmentDetail) => {
    try {
      await updateStatus.mutateAsync({ id: appointment.id, status: 'IN_CONSULTATION' });
      if (appointment.visitId) navigate(`/visits/${appointment.visitId}`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not start consultation.'));
    }
  };

  const onDone = async (appointment: AppointmentDetail) => {
    try {
      await updateStatus.mutateAsync({ id: appointment.id, status: 'DONE' });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not update status.'));
    }
  };

  const onNoShowSubmit = async (reason: string) => {
    if (!noShowTarget) return;
    try {
      await updateStatus.mutateAsync({ id: noShowTarget.id, status: 'NO_SHOW', reason });
      toast.success(`${noShowTarget.patientName} marked no-show`);
      setNoShowTarget(null);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not update status.'));
    }
  };

  if (isLoading) return <p className="text-sm text-gray-400">Loading...</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        {!queue || queue.nowServing.length === 0 ? (
          <p className="text-lg font-semibold text-[var(--color-navy)]">No one in consultation</p>
        ) : (
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            {queue.nowServing.map((s) => (
              <p key={s.tokenNo} className="text-lg font-semibold text-[var(--color-navy)]">
                Now serving token {s.tokenNo}
                {s.doctorName && <span className="text-sm font-normal text-gray-500"> — {s.doctorName}</span>}
              </p>
            ))}
          </div>
        )}
        <p className="text-sm text-gray-500">{queue?.waiting ?? 0} waiting</p>
      </div>

      {!queue || queue.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <ListOrdered className="h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm text-gray-400">Queue is empty.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {queue.items.map((a) => {
            const waitMinutes = a.status === 'ARRIVED' ? waitingMinutes(a.updatedAt) : null;
            const isOverdue = waitMinutes !== null && waitMinutes >= WAITING_ALERT_MINUTES;
            return (
              <div key={a.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-center gap-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 font-semibold text-gray-700">
                    {a.tokenNo}
                  </span>
                  <div>
                    <p className="font-medium text-gray-800">{a.patientName}</p>
                    <p className="text-xs text-gray-400">
                      {a.timeSlot} · {a.mobile}
                      {a.doctorName && ` · ${a.doctorName}`}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[a.status]}`}>
                    {a.status.replace('_', ' ')}
                  </span>
                  {waitMinutes !== null && (
                    <span
                      className={cn(
                        'flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                        isOverdue ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500',
                      )}
                    >
                      {isOverdue && <AlertCircle className="h-3 w-3" />}
                      Waiting {waitMinutes} min
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <a href={`tel:${a.mobile}`} className="rounded-lg border border-gray-300 p-1.5 text-gray-500 hover:bg-gray-50" title="Call">
                    <Phone className="h-4 w-4" />
                  </a>
                  <a
                    href={waLink(
                      a.mobile,
                      `Dear ${a.patientName}, your appointment is confirmed at ${a.timeSlot}${clinic ? ` at ${clinic.name}` : ''}.`,
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-gray-300 p-1.5 text-green-600 hover:bg-green-50"
                    title="WhatsApp"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </a>
                  {(a.status === 'BOOKED' || a.status === 'CONFIRMED') &&
                    (a.patientId ? (
                      <button
                        onClick={() => onArrived(a)}
                        disabled={markArrived.isPending}
                        className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                      >
                        Arrived
                      </button>
                    ) : (
                      <button
                        onClick={() => setLinkTarget(a)}
                        className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                        title="Register or link a patient before marking arrived"
                      >
                        <Link2 className="h-3.5 w-3.5" /> Link Patient
                      </button>
                    ))}
                  {a.status === 'ARRIVED' && a.visitId && hasPermission(currentUser, 'vitals:edit') && (
                    <button
                      onClick={() => setVitalsTarget(a)}
                      className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      title="Record vitals before the doctor starts"
                    >
                      <Activity className="h-3.5 w-3.5" /> Vitals
                    </button>
                  )}
                  {a.status === 'ARRIVED' && (
                    <button
                      onClick={() => onStart(a)}
                      className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                    >
                      Start
                    </button>
                  )}
                  {a.status === 'IN_CONSULTATION' && (
                    <button
                      onClick={() => onDone(a)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      Done
                    </button>
                  )}
                  {(a.status === 'BOOKED' || a.status === 'CONFIRMED') && (
                    <button
                      onClick={() => setNoShowTarget(a)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      No-show
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {linkTarget && (
        <LinkPatientModal open={Boolean(linkTarget)} onClose={() => setLinkTarget(null)} appointment={linkTarget} />
      )}
      {vitalsTarget && (
        <VitalsModal open={Boolean(vitalsTarget)} onClose={() => setVitalsTarget(null)} appointment={vitalsTarget} />
      )}
      <ReasonPromptModal
        open={Boolean(noShowTarget)}
        title={`Mark ${noShowTarget?.patientName} as no-show?`}
        onClose={() => setNoShowTarget(null)}
        onSubmit={onNoShowSubmit}
        isPending={updateStatus.isPending}
      />
    </div>
  );
}

export function AppointmentsPage() {
  const [tab, setTab] = useState<'day' | 'queue'>('day');
  const [date, setDate] = useState(todayIso());

  const onJumpToDate = (targetDate: string) => {
    setDate(targetDate);
    setTab('day');
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-navy)]">Appointments</h1>
          <p className="text-sm text-gray-500">Book, manage and run today's queue.</p>
        </div>
        <AppointmentSearchBox onJumpToDate={onJumpToDate} />
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setTab('day')}
          className={`border-b-2 px-4 py-2.5 text-sm font-medium ${tab === 'day' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Day View
        </button>
        <button
          onClick={() => setTab('queue')}
          className={`border-b-2 px-4 py-2.5 text-sm font-medium ${tab === 'queue' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Today's Queue
        </button>
      </div>

      {tab === 'day' ? <DayView date={date} onDateChange={setDate} /> : <QueueView />}
    </div>
  );
}
