import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreatePatientResponse,
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
    const where = {
      isActive: query.isActive === undefined ? true : query.isActive === 'true',
      ...(query.gender ? { gender: query.gender } : {}),
      ...(query.city ? { city: { contains: query.city } } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.patient.findMany({
        where,
        orderBy: { registeredOn: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.patient.count({ where }),
    ]);

    return { items: rows.map((row) => this.toSummary(row)), total, page, pageSize };
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
          ? [{ mobile: { contains: query } }, { patientId: { contains: query } }]
          : [
              { name: { contains: query } },
              { mobile: { contains: query } },
              { patientId: { contains: query } },
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
    return this.toDetail(patient);
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
    const [duplicateMobile, patientId] = await Promise.all([
      this.prisma.patient.findFirst({ where: { mobile: dto.mobile, isActive: true } }),
      this.numberService.getNext('PATIENT'),
    ]);

    const patient = await this.prisma.patient.create({
      data: {
        patientId,
        name: dto.name,
        age: dto.age,
        dob: dto.dob ? new Date(dto.dob) : undefined,
        gender: dto.gender,
        mobile: dto.mobile,
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
        referredBy: dto.referredBy,
        notes: dto.notes,
        createdBy,
      },
    });

    return { duplicateMobileWarning: Boolean(duplicateMobile), patient: this.toDetail(patient) };
  }

  async update(id: string, dto: UpdatePatientDto): Promise<PatientDetail> {
    await this.assertExists(id);

    const patient = await this.prisma.patient.update({
      where: { id },
      data: { ...dto, dob: dto.dob ? new Date(dto.dob) : undefined },
    });

    return this.toDetail(patient);
  }

  async deactivate(id: string): Promise<PatientDetail> {
    await this.assertExists(id);
    const patient = await this.prisma.patient.update({ where: { id }, data: { isActive: false } });
    return this.toDetail(patient);
  }

  async reactivate(id: string): Promise<PatientDetail> {
    await this.assertExists(id);
    const patient = await this.prisma.patient.update({ where: { id }, data: { isActive: true } });
    return this.toDetail(patient);
  }

  async setPhoto(id: string, photoPath: string): Promise<PatientDetail> {
    await this.assertExists(id);
    const patient = await this.prisma.patient.update({ where: { id }, data: { photoPath } });
    return this.toDetail(patient);
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
        photoPath: visit.patient.photoPath,
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

  private toSummary(patient: Patient): PatientSummary {
    return {
      id: patient.id,
      patientId: patient.patientId,
      name: patient.name,
      age: patient.age,
      gender: patient.gender as PatientSummary['gender'],
      mobile: patient.mobile,
      city: patient.city,
      isActive: patient.isActive,
    };
  }

  private toDetail(patient: Patient): PatientDetail {
    return {
      ...this.toSummary(patient),
      dob: patient.dob ? patient.dob.toISOString() : null,
      altMobile: patient.altMobile,
      email: patient.email,
      address: patient.address,
      pincode: patient.pincode,
      bloodGroup: patient.bloodGroup,
      maritalStatus: patient.maritalStatus,
      occupation: patient.occupation,
      photoPath: patient.photoPath,
      allergies: patient.allergies,
      chronicDiseases: patient.chronicDiseases,
      referredBy: patient.referredBy,
      notes: patient.notes,
      registeredOn: patient.registeredOn.toISOString(),
    };
  }
}
