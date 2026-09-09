import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreatePatientResponse,
  PatientCustomFieldValues,
  PatientDetail,
  PatientHistoryResponse,
  PatientHistoryVisit,
  PatientListResponse,
  PatientSearchResult,
  PatientSummary,
} from '@clinic-care/shared-types';
import { LabTest, Patient, Prescription, PrescriptionItem, Vital, Visit } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NumberService } from '../number/number.service';
import { DocumentsService } from '../documents/documents.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { ListPatientsQueryDto } from './dto/list-patients-query.dto';

const HISTORY_INCLUDE = {
  vital: true,
  labTests: true,
  prescription: { include: { items: true } },
  patient: true,
} as const;

type HistoryVisitRow = Visit & {
  patient: Patient;
  vital: Vital | null;
  labTests: LabTest[];
  prescription: (Prescription & { items: PrescriptionItem[] }) | null;
};

function patientDateBoundary(value: string | undefined, boundary: 'start' | 'end'): Date | undefined {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T${boundary === 'start' ? '00:00:00.000' : '23:59:59.999'}+05:30`);
  }
  const date = new Date(value);
  if (boundary === 'end') date.setHours(23, 59, 59, 999);
  return date;
}

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numberService: NumberService,
    private readonly documentsService: DocumentsService,
  ) {}

  async list(query: ListPatientsQueryDto): Promise<PatientListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const search = query.search?.trim();
    const where = {
      isActive: query.isActive === undefined ? true : query.isActive === 'true',
      ...(query.gender ? { gender: query.gender } : {}),
      ...(query.city ? { city: { contains: query.city, mode: 'insensitive' as const } } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { mobile: { contains: search } },
              { patientId: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(query.registeredFrom || query.registeredTo
        ? {
            registeredOn: {
              ...(query.registeredFrom ? { gte: patientDateBoundary(query.registeredFrom, 'start') } : {}),
              ...(query.registeredTo ? { lte: patientDateBoundary(query.registeredTo, 'end') } : {}),
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.patient.findMany({
        where,
        include: { _count: { select: { visits: true } } },
        orderBy: { registeredOn: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.patient.count({ where }),
    ]);

    return { items: rows.map((row) => this.toSummary(row, row._count.visits)), total, page, pageSize };
  }

  /** Type mobile first: an all-digit query matches mobile first, otherwise name/patientId/mobile all match. */
  async search(q: string): Promise<PatientSearchResult[]> {
    const query = q.trim();
    if (!query) return [];

    const isDigitsOnly = /^\d+$/.test(query);

    const rows = await this.prisma.patient.findMany({
      where: {
        isActive: true,
        OR: isDigitsOnly
          ? [{ mobile: { contains: query } }, { patientId: { contains: query, mode: 'insensitive' } }]
          : [
              { name: { contains: query, mode: 'insensitive' } },
              { mobile: { contains: query } },
              { patientId: { contains: query, mode: 'insensitive' } },
            ],
      },
      orderBy: isDigitsOnly ? { mobile: 'asc' } : { name: 'asc' },
      take: 10,
    });

    return rows.map((row) => ({
      id: row.id,
      patientId: row.patientId,
      name: row.name,
      age: row.age,
      gender: row.gender as PatientSearchResult['gender'],
      mobile: row.mobile,
    }));
  }

  async getById(id: string): Promise<PatientDetail> {
    const patient = await this.prisma.patient.findUnique({ where: { id } });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }
    return this.toDetailWithCounts(patient);
  }

  /** Combined timeline the doctor opens before seeing a returning patient — everything built so far, newest first. */
  async getHistory(patientId: string): Promise<PatientHistoryResponse> {
    await this.assertExists(patientId);

    const [visits, documents, topMedicines] = await Promise.all([
      this.prisma.visit.findMany({
        where: { patientId },
        include: HISTORY_INCLUDE,
        orderBy: { visitDate: 'desc' },
      }),
      this.documentsService.listByPatient(patientId),
      this.prisma.prescriptionItem.groupBy({
        by: ['medicineName'],
        where: { prescription: { patientId } },
        _count: { medicineName: true },
        orderBy: { _count: { medicineName: 'desc' } },
        take: 3,
      }),
    ]);

    const visitDates = visits.map((v) => v.visitDate);
    const summary = {
      totalVisits: visits.length,
      firstVisitDate: visitDates.length ? new Date(Math.min(...visitDates.map((d) => d.getTime()))).toISOString() : null,
      lastVisitDate: visitDates.length ? new Date(Math.max(...visitDates.map((d) => d.getTime()))).toISOString() : null,
      mostPrescribedMedicines: topMedicines.map((m) => ({
        medicineName: m.medicineName,
        count: m._count.medicineName,
      })),
    };

    return {
      summary,
      visits: visits.map((visit) => this.toHistoryVisit(visit)),
      documents,
    };
  }

  async create(dto: CreatePatientDto, createdBy?: string): Promise<CreatePatientResponse> {
    const [duplicateMobile, patientId, defs] = await Promise.all([
      dto.mobile ? this.prisma.patient.findFirst({ where: { mobile: dto.mobile, isActive: true } }) : null,
      this.numberService.getNext('PATIENT'),
      this.prisma.patientFieldDefinition.findMany({ where: { isActive: true } }),
    ]);

    const validKeys = new Set(defs.map((d) => d.key));
    const customFields = this.mergeCustomFields(dto.customFields, null, validKeys);
    this.assertRequiredFieldsSatisfied(defs, { ...this.buildCoreFieldValues(dto), ...customFields });
    this.assertDobIsNotFuture(dto.dob);

    const patient = await this.prisma.patient.create({
      data: {
        patientId,
        // name/age/gender/mobile are NOT NULL columns — fall back to a sentinel
        // ("", 0, UNSPECIFIED) when admin has made the field optional/hidden and it
        // was left blank, so every existing display site keeps a real value to read.
        name: dto.name || '',
        age: dto.age ?? 0,
        dob: dto.dob ? new Date(dto.dob) : undefined,
        gender: dto.gender ?? 'UNSPECIFIED',
        mobile: dto.mobile || '',
        altMobile: dto.altMobile,
        email: dto.email,
        address: dto.address,
        city: dto.city,
        pincode: dto.pincode,
        bloodGroup: dto.bloodGroup,
        maritalStatus: dto.maritalStatus,
        occupation: dto.occupation,
        allergies: dto.allergies,
        chronicDiseases: dto.chronicDiseases,
        stage: dto.stage,
        referredBy: dto.referredBy,
        notes: dto.notes,
        createdBy,
        customFields: JSON.stringify(customFields),
      },
    });

    return { duplicateMobileWarning: Boolean(duplicateMobile), patient: await this.toDetailWithCounts(patient) };
  }

  async update(id: string, dto: UpdatePatientDto): Promise<PatientDetail> {
    const { customFields, ...rest } = dto;
    const existing = await this.prisma.patient.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Patient not found');
    }

    const defs = await this.prisma.patientFieldDefinition.findMany({ where: { isActive: true } });
    const validKeys = new Set(defs.map((d) => d.key));
    const mergedCustomFields = this.mergeCustomFields(customFields, existing.customFields, validKeys);
    this.assertRequiredFieldsSatisfied(defs, { ...this.mergeCoreFieldValues(dto, existing), ...mergedCustomFields });
    this.assertDobIsNotFuture(dto.dob);

    const patient = await this.prisma.patient.update({
      where: { id },
      data: {
        ...rest,
        dob: dto.dob ? new Date(dto.dob) : undefined,
        customFields: JSON.stringify(mergedCustomFields),
      },
    });

    return this.toDetailWithCounts(patient);
  }

  async deactivate(id: string): Promise<PatientDetail> {
    await this.assertExists(id);
    const patient = await this.prisma.patient.update({ where: { id }, data: { isActive: false } });
    return this.toDetailWithCounts(patient);
  }

  async reactivate(id: string): Promise<PatientDetail> {
    await this.assertExists(id);
    const patient = await this.prisma.patient.update({ where: { id }, data: { isActive: true } });
    return this.toDetailWithCounts(patient);
  }

  /**
   * Merges submitted custom values into whatever's already stored (so a field that
   * got deactivated after being set isn't silently dropped on the next edit) and
   * drops keys that don't match an active field definition.
   */
  private mergeCustomFields(
    input: PatientCustomFieldValues | undefined,
    existingJson: string | null,
    validKeys: Set<string>,
  ): PatientCustomFieldValues {
    const merged: PatientCustomFieldValues = existingJson ? JSON.parse(existingJson) : {};
    for (const [key, value] of Object.entries(input ?? {})) {
      if (validKeys.has(key)) merged[key] = value;
    }
    return merged;
  }

  /** Raw submitted values for every built-in (isCore) field, keyed the same as PatientFieldDefinition.key. */
  private buildCoreFieldValues(dto: CreatePatientDto | UpdatePatientDto): Record<string, unknown> {
    return {
      name: dto.name,
      gender: dto.gender,
      dob: dto.dob,
      age: dto.age,
      mobile: dto.mobile,
      altMobile: dto.altMobile,
      email: dto.email,
      address: dto.address,
      city: dto.city,
      pincode: dto.pincode,
      bloodGroup: dto.bloodGroup,
      maritalStatus: dto.maritalStatus,
      occupation: dto.occupation,
      referredBy: dto.referredBy,
      stage: dto.stage,
      allergies: dto.allergies,
      chronicDiseases: dto.chronicDiseases,
      notes: dto.notes,
    };
  }

  /** Same as buildCoreFieldValues, but a field the dto didn't touch falls back to what's already stored. */
  private mergeCoreFieldValues(dto: UpdatePatientDto, existing: Patient): Record<string, unknown> {
    return {
      name: dto.name ?? existing.name,
      gender: dto.gender ?? existing.gender,
      dob: dto.dob ?? existing.dob,
      age: dto.age ?? existing.age,
      mobile: dto.mobile ?? existing.mobile,
      altMobile: dto.altMobile ?? existing.altMobile,
      email: dto.email ?? existing.email,
      address: dto.address ?? existing.address,
      city: dto.city ?? existing.city,
      pincode: dto.pincode ?? existing.pincode,
      bloodGroup: dto.bloodGroup ?? existing.bloodGroup,
      maritalStatus: dto.maritalStatus ?? existing.maritalStatus,
      occupation: dto.occupation ?? existing.occupation,
      referredBy: dto.referredBy ?? existing.referredBy,
      stage: dto.stage ?? existing.stage,
      allergies: dto.allergies ?? existing.allergies,
      chronicDiseases: dto.chronicDiseases ?? existing.chronicDiseases,
      notes: dto.notes ?? existing.notes,
    };
  }

  /**
   * Enforces admin-marked required fields (core or custom alike) against the final
   * merged state — not just what was submitted this call — so a required field can't
   * be bypassed by simply omitting it from the request.
   */
  private assertRequiredFieldsSatisfied(
    defs: { key: string; label: string; fieldType: string; options: string | null; required: boolean; isActive?: boolean }[],
    values: Record<string, unknown>,
  ): void {
    const errors: string[] = [];

    for (const field of defs) {
      if (field.isActive === false) continue;

      const rawValue = values[field.key];
      const value = String(rawValue ?? '').trim();
      if (field.required && !value) {
        errors.push(`${field.label} is required`);
        continue;
      }
      if (!value) continue;

      if (field.fieldType === 'NUMBER' && !Number.isFinite(Number(rawValue))) {
        errors.push(`${field.label} must be a valid number`);
      }
      if (field.fieldType === 'DATE' && !this.isValidFieldDate(rawValue)) {
        errors.push(`${field.label} must be a valid date`);
      }
      const options = this.parseFieldOptions(field.options);
      if (field.fieldType === 'SELECT' && options.length > 0 && !options.includes(value)) {
        errors.push(`${field.label} must be one of the configured options`);
      }
      if (field.fieldType === 'BOOLEAN' && rawValue !== true && rawValue !== false && value !== 'true' && value !== 'false') {
        errors.push(`${field.label} must be checked or unchecked`);
      }
    }

    if (errors.length) {
      throw new BadRequestException(errors.join(', '));
    }
  }

  private parseFieldOptions(optionsJson: string | null): string[] {
    if (!optionsJson) return [];
    try {
      const parsed: unknown = JSON.parse(optionsJson);
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch {
      return [];
    }
  }

  private isValidFieldDate(value: unknown): boolean {
    if (value instanceof Date) return !Number.isNaN(value.getTime());
    if (typeof value !== 'string') return false;
    return !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
  }

  private assertDobIsNotFuture(dob?: string): void {
    if (!dob) return;
    const selected = new Date(dob);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (selected > today) {
      throw new BadRequestException('Date of birth cannot be in the future');
    }
  }

  private async assertExists(id: string) {
    const exists = await this.prisma.patient.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      throw new NotFoundException('Patient not found');
    }
  }

  private toHistoryVisit(visit: HistoryVisitRow): PatientHistoryVisit {
    return {
      id: visit.id,
      visitNo: visit.visitNo,
      visitDate: visit.visitDate.toISOString(),
      visitType: visit.visitType as PatientHistoryVisit['visitType'],
      status: visit.status as PatientHistoryVisit['status'],
      complaint: visit.complaint,
      diagnosis: visit.diagnosis,
      patientId: visit.patientId,
      patient: {
        id: visit.patient.id,
        patientId: visit.patient.patientId,
        name: visit.patient.name,
        age: visit.patient.age,
        gender: visit.patient.gender as PatientHistoryVisit['patient']['gender'],
        mobile: visit.patient.mobile,
        allergies: visit.patient.allergies,
        chronicDiseases: visit.patient.chronicDiseases,
      },
      complaintDurationDays: visit.complaintDurationDays,
      examination: visit.examination,
      advice: visit.advice,
      testsAdvised: visit.testsAdvised,
      nextFollowUpDate: visit.nextFollowUpDate ? visit.nextFollowUpDate.toISOString() : null,
      followUpAfterDays: visit.followUpAfterDays,
      consultationFee: visit.consultationFee,
      remark: visit.remark,
      customFields: visit.customFields ? JSON.parse(visit.customFields) : {},
      vital: visit.vital
        ? {
            id: visit.vital.id,
            bp: visit.vital.bp ?? undefined,
            pulse: visit.vital.pulse ?? undefined,
            temperature: visit.vital.temperature ?? undefined,
            weight: visit.vital.weight ?? undefined,
            height: visit.vital.height ?? undefined,
            bmi: visit.vital.bmi,
            spo2: visit.vital.spo2 ?? undefined,
            respiratoryRate: visit.vital.respiratoryRate ?? undefined,
            sugarRandom: visit.vital.sugarRandom ?? undefined,
            notes: visit.vital.notes ?? undefined,
          }
        : null,
      labTests: visit.labTests.map((test) => ({
        id: test.id,
        testName: test.testName,
        advisedOn: test.advisedOn.toISOString(),
        resultValue: test.resultValue,
        resultUnit: test.resultUnit,
        normalRange: test.normalRange,
        resultDate: test.resultDate ? test.resultDate.toISOString() : null,
        remark: test.remark,
        status: test.status as PatientHistoryVisit['labTests'][number]['status'],
      })),
      prescription: visit.prescription
        ? {
            id: visit.prescription.id,
            itemCount: visit.prescription.items.length,
            generalInstruction: visit.prescription.generalInstruction,
          }
        : null,
    };
  }

  private toSummary(patient: Patient, visitCount: number): PatientSummary {
    return {
      id: patient.id,
      patientId: patient.patientId,
      name: patient.name,
      age: patient.age,
      gender: patient.gender as PatientSummary['gender'],
      mobile: patient.mobile,
      city: patient.city,
      isActive: patient.isActive,
      visitCount,
      stage: patient.stage,
    };
  }

  /** Adds visit count + soonest pending follow-up — a single extra query, run only for one patient at a time. */
  private async toDetailWithCounts(patient: Patient): Promise<PatientDetail> {
    const [visitCount, nextFollowUp] = await Promise.all([
      this.prisma.visit.count({ where: { patientId: patient.id } }),
      this.prisma.followUp.findFirst({
        where: { patientId: patient.id, status: 'PENDING' },
        orderBy: { dueDate: 'asc' },
      }),
    ]);

    return {
      ...this.toSummary(patient, visitCount),
      dob: patient.dob ? patient.dob.toISOString() : null,
      altMobile: patient.altMobile,
      email: patient.email,
      address: patient.address,
      pincode: patient.pincode,
      bloodGroup: patient.bloodGroup,
      maritalStatus: patient.maritalStatus,
      occupation: patient.occupation,
      allergies: patient.allergies,
      chronicDiseases: patient.chronicDiseases,
      referredBy: patient.referredBy,
      notes: patient.notes,
      registeredOn: patient.registeredOn.toISOString(),
      nextFollowUp: nextFollowUp
        ? { dueDate: nextFollowUp.dueDate.toISOString(), purpose: nextFollowUp.purpose }
        : null,
      customFields: patient.customFields ? JSON.parse(patient.customFields) : {},
    };
  }
}
