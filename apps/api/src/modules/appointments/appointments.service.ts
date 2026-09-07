import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Appointment } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type {
  AppointmentDetail,
  AppointmentStatus,
  BookAppointmentResponse,
  DoctorOption,
} from '@clinic-care/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { VisitsService } from '../visits/visits.service';
import { BillingService } from '../billing/billing.service';
import { istDayBounds, parseIstDate } from '../../common/utils/ist-date';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';

// Anything not listed here is a terminal state (DONE/CANCELLED/NO_SHOW) — no transitions out.
const ALLOWED_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  BOOKED: ['CONFIRMED', 'ARRIVED', 'CANCELLED', 'NO_SHOW'],
  CONFIRMED: ['ARRIVED', 'CANCELLED', 'NO_SHOW'],
  ARRIVED: ['IN_CONSULTATION', 'CANCELLED'],
  IN_CONSULTATION: ['DONE'],
  DONE: [],
  CANCELLED: [],
  NO_SHOW: [],
};
const REASON_REQUIRED_STATUSES: AppointmentStatus[] = ['CANCELLED', 'NO_SHOW'];

const EDITABLE_STATUSES: AppointmentStatus[] = ['BOOKED', 'CONFIRMED'];
// A DONE appointment already has a real clinical Visit attached — "rescheduling" it has
// no sensible meaning, a follow-up would be a new appointment. Every other status
// (including NO_SHOW/CANCELLED) can be revived onto a new date.
const RESCHEDULABLE_STATUSES: AppointmentStatus[] = ['BOOKED', 'CONFIRMED', 'ARRIVED', 'IN_CONSULTATION', 'CANCELLED', 'NO_SHOW'];

const MAX_ADVANCE_DAYS = 90;
const SEARCH_LIMIT = 20;

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly visitsService: VisitsService,
    private readonly billingService: BillingService,
  ) {}

  async book(dto: CreateAppointmentDto, createdBy: string): Promise<BookAppointmentResponse> {
    this.assertValidDate(dto.appointmentDate);
    const { start, end } = istDayBounds(parseIstDate(dto.appointmentDate));
    const [duplicateSlotWarning, duplicatePatientWarning, doctor] = await Promise.all([
      this.hasActiveConflict(start, end, dto.timeSlot, dto.doctorId),
      dto.patientId ? this.hasActivePatientConflict(start, end, dto.patientId) : Promise.resolve(false),
      this.resolveDoctor(dto.doctorId),
    ]);

    // Token allocation must be unique per day — two receptionist computers booking at the
    // same moment (the guide's own multi-computer setup) could otherwise both count the
    // same total and hand out the same token number, since Mongo transactions don't lock
    // the count's range. The @@unique([appointmentDate, tokenNo]) index is the real
    // safety net: the loser's create() fails and withTokenRetry recomputes a fresh token.
    const appointment = await this.withTokenRetry(() =>
      this.prisma.$transaction(async (tx) => {
        const tokenNo = await this.nextTokenForDay(tx, start, end);
        return tx.appointment.create({
          data: {
            patientId: dto.patientId,
            patientName: dto.patientName,
            mobile: dto.mobile,
            appointmentDate: start,
            timeSlot: dto.timeSlot,
            tokenNo,
            doctorId: doctor?.id,
            doctorName: doctor?.name,
            purpose: dto.purpose,
            source: dto.source ?? 'WALK_IN',
            createdBy,
          },
        });
      }),
    );

    return { duplicateSlotWarning, duplicatePatientWarning, appointment: this.toDetail(appointment) };
  }

  /** Moves an appointment to a new date (and optionally time) with a fresh token for that day. */
  async reschedule(id: string, dto: RescheduleAppointmentDto): Promise<BookAppointmentResponse> {
    const existing = await this.findOrThrow(id);
    this.assertNotStale(existing, dto.expectedUpdatedAt);
    if (!RESCHEDULABLE_STATUSES.includes(existing.status as AppointmentStatus)) {
      throw new BadRequestException('A completed appointment cannot be rescheduled — book a new appointment instead.');
    }
    this.assertValidDate(dto.newDate);

    const { start, end } = istDayBounds(parseIstDate(dto.newDate));
    const timeSlot = dto.newTimeSlot ?? existing.timeSlot;
    const [duplicateSlotWarning, duplicatePatientWarning] = await Promise.all([
      this.hasActiveConflict(start, end, timeSlot, existing.doctorId, id),
      existing.patientId ? this.hasActivePatientConflict(start, end, existing.patientId, id) : Promise.resolve(false),
    ]);

    const appointment = await this.withTokenRetry(() =>
      this.prisma.$transaction(async (tx) => {
        const tokenNo = await this.nextTokenForDay(tx, start, end);
        return tx.appointment.update({
          where: { id },
          data: {
            appointmentDate: start,
            timeSlot,
            tokenNo,
            status: 'BOOKED',
            // Clears any stale "reschedule requested" flag (or old cancel reason) — this
            // reschedule is the resolution of it, not something still pending.
            remark: null,
          },
        });
      }),
    );

    return { duplicateSlotWarning, duplicatePatientWarning, appointment: this.toDetail(appointment) };
  }

  async update(id: string, dto: UpdateAppointmentDto): Promise<BookAppointmentResponse> {
    const existing = await this.findOrThrow(id);
    this.assertNotStale(existing, dto.expectedUpdatedAt);
    if (!EDITABLE_STATUSES.includes(existing.status as AppointmentStatus)) {
      throw new BadRequestException(
        `Cannot edit an appointment that is already ${existing.status.toLowerCase().replace('_', ' ')} — cancel and rebook instead.`,
      );
    }

    const doctor = dto.doctorId !== undefined ? await this.resolveDoctor(dto.doctorId) : undefined;

    // book()/reschedule() both check for a double-booked slot before committing — update()
    // can also change the doctor onto this same date/time and was silently skipping the
    // same check, letting two patients land on one doctor's calendar at the same slot.
    const duplicateSlotWarning =
      doctor !== undefined && (doctor?.id ?? null) !== existing.doctorId
        ? await this.hasActiveConflict(existing.appointmentDate, existing.appointmentDate, existing.timeSlot, doctor?.id, id)
        : false;

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        ...(dto.patientName ? { patientName: dto.patientName } : {}),
        ...(dto.mobile ? { mobile: dto.mobile } : {}),
        ...(dto.purpose !== undefined ? { purpose: dto.purpose } : {}),
        ...(doctor !== undefined ? { doctorId: doctor?.id ?? null, doctorName: doctor?.name ?? null } : {}),
      },
    });
    return { duplicateSlotWarning, duplicatePatientWarning: false, appointment: this.toDetail(updated) };
  }

  /** Claims a walk-in ("new caller") appointment for a patient record created after the fact. */
  async linkPatient(id: string, patientId: string): Promise<AppointmentDetail> {
    const existing = await this.findOrThrow(id);
    if (existing.patientId) {
      throw new BadRequestException('This appointment is already linked to a patient.');
    }

    const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { patientId: patient.id, patientName: patient.name, mobile: patient.mobile },
    });
    return this.toDetail(updated);
  }

  async listByDay(date: string): Promise<AppointmentDetail[]> {
    const { start, end } = istDayBounds(parseIstDate(date));
    const rows = await this.prisma.appointment.findMany({
      where: { appointmentDate: { gte: start, lte: end } },
      orderBy: [{ timeSlot: 'asc' }, { tokenNo: 'asc' }],
    });
    return rows.map((r) => this.toDetail(r));
  }

  async getForPatient(patientId: string): Promise<AppointmentDetail[]> {
    const rows = await this.prisma.appointment.findMany({
      where: { patientId },
      orderBy: { appointmentDate: 'desc' },
    });
    return rows.map((r) => this.toDetail(r));
  }

  async search(q: string): Promise<AppointmentDetail[]> {
    const query = q.trim();
    if (!query) return [];

    const rows = await this.prisma.appointment.findMany({
      where: { OR: [{ patientName: { contains: query, mode: 'insensitive' } }, { mobile: { contains: query } }] },
      orderBy: { appointmentDate: 'desc' },
      take: SEARCH_LIMIT,
    });
    return rows.map((r) => this.toDetail(r));
  }

  async listDoctors(): Promise<DoctorOption[]> {
    const doctors = await this.prisma.user.findMany({
      where: { isActive: true, role: { name: 'DOCTOR' } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return doctors;
  }

  /** Now-serving is per doctor — two doctors can each have their own token in consultation at once. */
  async getQueue(): Promise<{
    items: AppointmentDetail[];
    nowServing: { tokenNo: number; doctorName: string | null }[];
    waiting: number;
  }> {
    const { start, end } = istDayBounds();
    const rows = await this.prisma.appointment.findMany({
      where: {
        appointmentDate: { gte: start, lte: end },
        status: { in: ['BOOKED', 'CONFIRMED', 'ARRIVED', 'IN_CONSULTATION'] },
      },
      orderBy: { tokenNo: 'asc' },
    });

    const nowServing = rows
      .filter((r) => r.status === 'IN_CONSULTATION')
      .map((r) => ({ tokenNo: r.tokenNo, doctorName: r.doctorName }));
    const waiting = rows.filter((r) => r.status === 'ARRIVED').length;

    // One batched query for the whole queue's vitals-recorded state, instead of a
    // per-row lookup — same reasoning as the string-ref batching used elsewhere.
    const visitIds = rows.map((r) => r.visitId).filter((v): v is string => Boolean(v));
    const vitals = visitIds.length
      ? await this.prisma.vital.findMany({ where: { visitId: { in: visitIds } }, select: { visitId: true } })
      : [];
    const visitIdsWithVitals = new Set(vitals.map((v) => v.visitId));

    return {
      items: rows.map((r) => this.toDetail(r, Boolean(r.visitId && visitIdsWithVitals.has(r.visitId)))),
      nowServing,
      waiting,
    };
  }

  async updateStatus(id: string, status: AppointmentStatus, reason?: string): Promise<AppointmentDetail> {
    const existing = await this.findOrThrow(id);
    const current = existing.status as AppointmentStatus;
    if (status === current) {
      return this.toDetail(existing);
    }
    if (!ALLOWED_TRANSITIONS[current].includes(status)) {
      throw new BadRequestException(`Cannot move an appointment from ${current} to ${status}.`);
    }
    if (REASON_REQUIRED_STATUSES.includes(status) && !reason?.trim()) {
      throw new BadRequestException(`A reason is required to mark this appointment ${status.toLowerCase().replace('_', ' ')}.`);
    }

    // Cancelling an ARRIVED appointment leaves behind the Visit and auto-billed
    // consultation fee that markArrived already created — without this, they'd sit
    // around forever as a phantom WAITING visit and an unpaid bill nobody asked for.
    // Only this path needs a transaction; every other status change is a single write.
    const needsCascadeCancel = status === 'CANCELLED' && Boolean(existing.visitId);
    const updated = needsCascadeCancel
      ? await this.prisma.$transaction(async (tx) => {
          await this.visitsService.cancel(existing.visitId!, tx);
          await this.billingService.cancelVisitBillIfUnpaid(existing.visitId!, reason, tx);
          return tx.appointment.update({
            where: { id },
            data: { status, ...(reason ? { remark: reason } : {}) },
          });
        })
      : await this.prisma.appointment.update({
          where: { id },
          data: { status, ...(reason ? { remark: reason } : {}) },
        });
    return this.toDetail(updated);
  }

  /** Marks the appointment arrived AND starts a real Visit — Day 10 rule 2. */
  async markArrived(id: string, createdBy: string, createdByRole?: string): Promise<AppointmentDetail> {
    const appointment = await this.findOrThrow(id);

    // Idempotent: a double-click or retry must not create a second Visit for the same
    // appointment — just hand back what's already there.
    if (appointment.status !== 'BOOKED' && appointment.status !== 'CONFIRMED') {
      return this.toDetail(appointment);
    }
    const { patientId } = appointment;
    if (!patientId) {
      throw new BadRequestException(
        'This appointment has no registered patient yet — register the patient first, then mark arrived.',
      );
    }

    // The Visit's doctor is whoever the appointment was actually booked with, not whoever
    // is logged in and clicking this button — usually reception staff marking the patient
    // arrived, not the doctor themselves.
    const doctorId = appointment.doctorId;

    // One Mongo transaction for the whole chain (visit -> bill -> appointment) instead of
    // 3 independently-committed writes — each commit on the single-node replica set used
    // for local/LAN deployments pays its own journal-flush latency, which made this button
    // noticeably slow before batching it into one commit. Given an explicit, longer timeout
    // (Prisma's interactive-transaction default is 5s) — on a remote Atlas connection this
    // chain's several round trips can legitimately take longer than that default allows.
    const updated = await this.prisma.$transaction(
      async (tx) => {
        const visit = await this.visitsService.create({ patientId }, doctorId, createdBy, tx);
        await this.billingService.ensureVisitBill(
          visit.id,
          patientId,
          createdBy,
          tx,
          createdByRole ? { id: createdBy, role: createdByRole } : undefined,
        );
        return tx.appointment.update({
          where: { id },
          data: { status: 'ARRIVED', visitId: visit.id },
        });
      },
      { timeout: 15000 },
    );
    return this.toDetail(updated);
  }

  private assertValidDate(dateStr: string): void {
    const { start: todayStart } = istDayBounds();
    const target = parseIstDate(dateStr);
    if (target < todayStart) {
      throw new BadRequestException('Cannot book or reschedule an appointment into the past.');
    }
    const maxDate = new Date(todayStart.getTime() + MAX_ADVANCE_DAYS * 24 * 60 * 60 * 1000);
    if (target > maxDate) {
      throw new BadRequestException(`Cannot book more than ${MAX_ADVANCE_DAYS} days in advance.`);
    }
  }

  /** Optimistic concurrency: reject an edit based on a copy the client hasn't refreshed since someone else changed it. */
  private assertNotStale(existing: { updatedAt: Date }, expectedUpdatedAt: string): void {
    if (existing.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) {
      throw new ConflictException('This appointment was changed by someone else — refresh and try again.');
    }
  }

  // Per-doctor: a slot is only "taken" against the same doctor's calendar, so two
  // patients can share a time across different doctors. Appointments with no doctor
  // assigned form their own shared bucket (single-doctor clinics that never set
  // doctorId still get correct conflict detection against each other).
  private async hasActiveConflict(
    start: Date,
    end: Date,
    timeSlot: string,
    doctorId: string | null | undefined,
    excludeId?: string,
  ): Promise<boolean> {
    const conflict = await this.prisma.appointment.findFirst({
      where: {
        appointmentDate: { gte: start, lte: end },
        timeSlot,
        doctorId: doctorId ?? null,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    return Boolean(conflict);
  }

  private async hasActivePatientConflict(start: Date, end: Date, patientId: string, excludeId?: string): Promise<boolean> {
    const conflict = await this.prisma.appointment.findFirst({
      where: {
        appointmentDate: { gte: start, lte: end },
        patientId,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    return Boolean(conflict);
  }

  private async resolveDoctor(doctorId: string | undefined): Promise<{ id: string; name: string } | null | undefined> {
    if (doctorId === undefined) return undefined;
    if (!doctorId) return null;
    const doctor = await this.prisma.user.findFirst({
      where: { id: doctorId, isActive: true, role: { name: 'DOCTOR' } },
      select: { id: true, name: true },
    });
    if (!doctor) {
      throw new BadRequestException('Selected doctor was not found or is not an active doctor.');
    }
    return doctor;
  }

  private async nextTokenForDay(tx: Prisma.TransactionClient, start: Date, end: Date): Promise<number> {
    const countForDay = await tx.appointment.count({ where: { appointmentDate: { gte: start, lte: end } } });
    return countForDay + 1;
  }

  /** Retries a token-assigning transaction when the @@unique([appointmentDate, tokenNo])
   * index catches two concurrent bookings computing the same token — the loser just
   * recomputes a fresh count and tries again, invisibly to the caller. */
  private async withTokenRetry<T>(run: () => Promise<T>): Promise<T> {
    const MAX_ATTEMPTS = 5;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return await run();
      } catch (error) {
        const isTokenClash = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
        if (!isTokenClash || attempt === MAX_ATTEMPTS) throw error;
      }
    }
    throw new Error('Unreachable');
  }

  private async findOrThrow(id: string) {
    const appointment = await this.prisma.appointment.findUnique({ where: { id } });
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }
    return appointment;
  }

  private toDetail(appointment: Appointment, hasVitals = false): AppointmentDetail {
    return {
      id: appointment.id,
      patientId: appointment.patientId,
      patientName: appointment.patientName,
      mobile: appointment.mobile,
      appointmentDate: appointment.appointmentDate.toISOString(),
      timeSlot: appointment.timeSlot,
      tokenNo: appointment.tokenNo,
      doctorId: appointment.doctorId,
      doctorName: appointment.doctorName,
      purpose: appointment.purpose,
      status: appointment.status as AppointmentStatus,
      source: appointment.source as AppointmentDetail['source'],
      remark: appointment.remark,
      visitId: appointment.visitId,
      hasVitals,
      updatedAt: appointment.updatedAt.toISOString(),
    };
  }
}
