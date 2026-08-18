import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  LabTestDetail,
  TodayVisitItem,
  VisitDetail,
  VisitPatientSummary,
  VisitSummary,
  VitalDetail,
} from '@clinic-care/shared-types';
import { LabTest, Patient, Vital, Visit } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NumberService } from '../number/number.service';
import { FollowUpsService } from '../followups/followups.service';
import { CreateVisitDto } from './dto/create-visit.dto';
import { UpdateVisitDto } from './dto/update-visit.dto';
import { SaveVitalsDto } from './dto/save-vitals.dto';
import { AdviseLabTestsDto } from './dto/advise-lab-tests.dto';
import { EnterLabResultDto } from './dto/enter-lab-result.dto';

type VisitWithRelations = Visit & { patient: Patient; vital: Vital | null; labTests: LabTest[] };

const VISIT_INCLUDE = { patient: true, vital: true, labTests: true } as const;

@Injectable()
export class VisitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numberService: NumberService,
    private readonly followUpsService: FollowUpsService,
  ) {}

  async listToday(): Promise<TodayVisitItem[]> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const visits = await this.prisma.visit.findMany({
      where: { visitDate: { gte: startOfDay, lte: endOfDay } },
      include: { patient: true },
      orderBy: { visitDate: 'asc' },
    });

    return visits.map((visit) => ({
      id: visit.id,
      visitNo: visit.visitNo,
      visitDate: visit.visitDate.toISOString(),
      visitType: visit.visitType as TodayVisitItem['visitType'],
      status: visit.status as TodayVisitItem['status'],
      patient: this.toPatientSummary(visit.patient),
    }));
  }

  async listByPatient(patientId: string): Promise<VisitSummary[]> {
    const visits = await this.prisma.visit.findMany({
      where: { patientId },
      orderBy: { visitDate: 'desc' },
    });
    return visits.map((visit) => this.toSummary(visit));
  }

  async getById(id: string): Promise<VisitDetail> {
    const visit = await this.prisma.visit.findUnique({ where: { id }, include: VISIT_INCLUDE });
    if (!visit) {
      throw new NotFoundException('Visit not found');
    }
    return this.toDetail(visit);
  }

  async create(dto: CreateVisitDto, doctorId: string, createdBy: string): Promise<VisitDetail> {
    const visitNo = await this.numberService.getNext('VISIT');
    const visit = await this.prisma.visit.create({
      data: {
        visitNo,
        patientId: dto.patientId,
        visitType: dto.visitType ?? 'NEW',
        doctorId,
        createdBy,
      },
      include: VISIT_INCLUDE,
    });

    // Day 9 rule: a new visit within 7 days of a pending follow-up counts as that
    // follow-up being kept, not missed — link it automatically.
    await this.followUpsService.linkVisitIfFollowUpDue(dto.patientId, visit.id);

    return this.toDetail(visit);
  }

  async start(id: string): Promise<VisitDetail> {
    await this.assertExists(id);
    const visit = await this.prisma.visit.update({
      where: { id },
      data: { status: 'IN_CONSULTATION' },
      include: VISIT_INCLUDE,
    });
    return this.toDetail(visit);
  }

  async update(id: string, dto: UpdateVisitDto): Promise<VisitDetail> {
    const existing = await this.assertExists(id);

    const visit = await this.prisma.visit.update({
      where: { id },
      data: {
        ...dto,
        nextFollowUpDate: dto.nextFollowUpDate ? new Date(dto.nextFollowUpDate) : undefined,
      },
      include: VISIT_INCLUDE,
    });

    // Keep the FollowUp row in sync with the visit's own nextFollowUpDate field, idempotently —
    // saving the same visit twice must not create duplicate follow-ups.
    if (dto.nextFollowUpDate) {
      const dueDate = new Date(dto.nextFollowUpDate);
      const existingFollowUp = await this.prisma.followUp.findFirst({ where: { visitId: id } });
      if (existingFollowUp) {
        await this.prisma.followUp.update({ where: { id: existingFollowUp.id }, data: { dueDate } });
      } else {
        await this.prisma.followUp.create({
          data: { patientId: existing.patientId, visitId: id, dueDate, status: 'PENDING' },
        });
      }
    }

    return this.toDetail(visit);
  }

  async saveVitals(visitId: string, dto: SaveVitalsDto): Promise<VitalDetail> {
    await this.assertExists(visitId);

    const bmi = this.computeBmi(dto.weight, dto.height);
    const vital = await this.prisma.vital.upsert({
      where: { visitId },
      update: { ...dto, bmi },
      create: { visitId, ...dto, bmi },
    });
    return this.toVitalDetail(vital);
  }

  async adviseLabTests(visitId: string, dto: AdviseLabTestsDto): Promise<LabTestDetail[]> {
    const visit = await this.assertExists(visitId);

    await this.prisma.labTest.createMany({
      data: dto.testNames.map((testName) => ({
        visitId,
        patientId: visit.patientId,
        testName,
      })),
    });

    const labTests = await this.prisma.labTest.findMany({ where: { visitId }, orderBy: { advisedOn: 'asc' } });
    return labTests.map((test) => this.toLabTestDetail(test));
  }

  async enterLabResult(labTestId: string, dto: EnterLabResultDto): Promise<LabTestDetail> {
    const exists = await this.prisma.labTest.findUnique({ where: { id: labTestId } });
    if (!exists) {
      throw new NotFoundException('Lab test not found');
    }

    const labTest = await this.prisma.labTest.update({
      where: { id: labTestId },
      data: {
        ...dto,
        resultDate: dto.resultDate ? new Date(dto.resultDate) : dto.resultValue ? new Date() : undefined,
        status: dto.resultValue ? 'DONE' : undefined,
      },
    });
    return this.toLabTestDetail(labTest);
  }

  async suggestComplaints(q: string): Promise<string[]> {
    const query = q.trim();
    if (!query) return [];

    const rows = await this.prisma.visit.findMany({
      where: { complaint: { contains: query } },
      select: { complaint: true },
      distinct: ['complaint'],
      take: 10,
      orderBy: { visitDate: 'desc' },
    });

    return rows.map((row) => row.complaint).filter((value): value is string => Boolean(value));
  }

  async suggestDiagnoses(q: string): Promise<string[]> {
    const query = q.trim();
    if (!query) return [];

    const rows = await this.prisma.visit.findMany({
      where: { diagnosis: { contains: query } },
      select: { diagnosis: true },
      distinct: ['diagnosis'],
      take: 10,
      orderBy: { visitDate: 'desc' },
    });

    return rows.map((row) => row.diagnosis).filter((value): value is string => Boolean(value));
  }

  private async assertExists(id: string) {
    const visit = await this.prisma.visit.findUnique({ where: { id } });
    if (!visit) {
      throw new NotFoundException('Visit not found');
    }
    return visit;
  }

  private computeBmi(weight?: number, height?: number): number | undefined {
    if (!weight || !height) return undefined;
    const heightInMeters = height / 100;
    return Math.round((weight / (heightInMeters * heightInMeters)) * 10) / 10;
  }

  private toPatientSummary(patient: Patient): VisitPatientSummary {
    return {
      id: patient.id,
      patientId: patient.patientId,
      name: patient.name,
      age: patient.age,
      gender: patient.gender as VisitPatientSummary['gender'],
      mobile: patient.mobile,
      photoPath: patient.photoPath,
      allergies: patient.allergies,
      chronicDiseases: patient.chronicDiseases,
    };
  }

  private toSummary(visit: Visit): VisitSummary {
    return {
      id: visit.id,
      visitNo: visit.visitNo,
      visitDate: visit.visitDate.toISOString(),
      visitType: visit.visitType as VisitSummary['visitType'],
      status: visit.status as VisitSummary['status'],
      complaint: visit.complaint,
      diagnosis: visit.diagnosis,
    };
  }

  private toDetail(visit: VisitWithRelations): VisitDetail {
    return {
      ...this.toSummary(visit),
      patientId: visit.patientId,
      patient: this.toPatientSummary(visit.patient),
      complaintDurationDays: visit.complaintDurationDays,
      examination: visit.examination,
      advice: visit.advice,
      testsAdvised: visit.testsAdvised,
      nextFollowUpDate: visit.nextFollowUpDate ? visit.nextFollowUpDate.toISOString() : null,
      followUpAfterDays: visit.followUpAfterDays,
      consultationFee: visit.consultationFee,
      remark: visit.remark,
      vital: visit.vital ? this.toVitalDetail(visit.vital) : null,
      labTests: visit.labTests.map((test) => this.toLabTestDetail(test)),
    };
  }

  private toVitalDetail(vital: Vital): VitalDetail {
    return {
      id: vital.id,
      bp: vital.bp ?? undefined,
      pulse: vital.pulse ?? undefined,
      temperature: vital.temperature ?? undefined,
      weight: vital.weight ?? undefined,
      height: vital.height ?? undefined,
      bmi: vital.bmi,
      spo2: vital.spo2 ?? undefined,
      respiratoryRate: vital.respiratoryRate ?? undefined,
      sugarRandom: vital.sugarRandom ?? undefined,
      notes: vital.notes ?? undefined,
    };
  }

  private toLabTestDetail(test: LabTest): LabTestDetail {
    return {
      id: test.id,
      testName: test.testName,
      advisedOn: test.advisedOn.toISOString(),
      resultValue: test.resultValue,
      resultUnit: test.resultUnit,
      normalRange: test.normalRange,
      resultDate: test.resultDate ? test.resultDate.toISOString() : null,
      remark: test.remark,
      status: test.status as LabTestDetail['status'],
    };
  }
}
