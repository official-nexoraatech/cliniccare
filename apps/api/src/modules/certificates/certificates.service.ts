import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Certificate } from '@prisma/client';
import type { CertificateDetail } from '@clinic-care/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { NumberService } from '../number/number.service';
import { IssueCertificateDto } from './dto/issue-certificate.dto';
import { CancelCertificateDto } from './dto/cancel-certificate.dto';

type CertificateWithPatient = Certificate & { patient: { name: string; mobile: string } };

const WITH_PATIENT = { patient: { select: { name: true, mobile: true } } };

@Injectable()
export class CertificatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numberService: NumberService,
  ) {}

  async issue(dto: IssueCertificateDto, issuedBy?: string): Promise<CertificateDetail> {
    const patient = await this.prisma.patient.findUnique({ where: { id: dto.patientId }, select: { id: true } });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    const certificateNo = await this.numberService.getNext('CERTIFICATE');
    const certificate = await this.prisma.certificate.create({
      data: {
        certificateNo,
        patientId: dto.patientId,
        visitId: dto.visitId,
        type: dto.type,
        fromDate: dto.fromDate ? new Date(dto.fromDate) : undefined,
        toDate: dto.toDate ? new Date(dto.toDate) : undefined,
        diagnosis: dto.diagnosis,
        bodyText: dto.bodyText,
        issuedBy,
      },
      include: WITH_PATIENT,
    });
    return this.toDetail(certificate);
  }

  async list(): Promise<CertificateDetail[]> {
    const certificates = await this.prisma.certificate.findMany({
      include: WITH_PATIENT,
      orderBy: { issueDate: 'desc' },
    });
    return certificates.map((c) => this.toDetail(c));
  }

  async listByPatient(patientId: string): Promise<CertificateDetail[]> {
    const certificates = await this.prisma.certificate.findMany({
      where: { patientId },
      include: WITH_PATIENT,
      orderBy: { issueDate: 'desc' },
    });
    return certificates.map((c) => this.toDetail(c));
  }

  async getById(id: string): Promise<CertificateDetail> {
    const certificate = await this.prisma.certificate.findUnique({ where: { id }, include: WITH_PATIENT });
    if (!certificate) {
      throw new NotFoundException('Certificate not found');
    }
    return this.toDetail(certificate);
  }

  async markPrinted(id: string): Promise<CertificateDetail> {
    const certificate = await this.prisma.certificate.update({
      where: { id },
      data: { printedAt: new Date(), printCount: { increment: 1 } },
      include: WITH_PATIENT,
    });
    return this.toDetail(certificate);
  }

  async cancel(id: string, dto: CancelCertificateDto): Promise<CertificateDetail> {
    const existing = await this.prisma.certificate.findUnique({ where: { id }, select: { status: true } });
    if (!existing) {
      throw new NotFoundException('Certificate not found');
    }
    if (existing.status === 'CANCELLED') {
      throw new BadRequestException('Certificate is already cancelled');
    }
    const certificate = await this.prisma.certificate.update({
      where: { id },
      data: { status: 'CANCELLED', cancelReason: dto.reason },
      include: WITH_PATIENT,
    });
    return this.toDetail(certificate);
  }

  private toDetail(certificate: CertificateWithPatient): CertificateDetail {
    return {
      id: certificate.id,
      certificateNo: certificate.certificateNo,
      patientId: certificate.patientId,
      patientName: certificate.patient.name,
      patientMobile: certificate.patient.mobile,
      visitId: certificate.visitId,
      type: certificate.type as CertificateDetail['type'],
      issueDate: certificate.issueDate.toISOString(),
      fromDate: certificate.fromDate?.toISOString() ?? null,
      toDate: certificate.toDate?.toISOString() ?? null,
      diagnosis: certificate.diagnosis,
      bodyText: certificate.bodyText,
      status: certificate.status as CertificateDetail['status'],
      cancelReason: certificate.cancelReason,
      issuedBy: certificate.issuedBy,
      printedAt: certificate.printedAt?.toISOString() ?? null,
      printCount: certificate.printCount,
    };
  }
}
