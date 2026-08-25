import { Injectable, NotFoundException } from '@nestjs/common';
import type { Clinic } from '@prisma/client';
import type { ClinicProfile } from '@clinic-care/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateClinicDto } from './dto/update-clinic.dto';

@Injectable()
export class ClinicService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(): Promise<ClinicProfile> {
    const clinic = await this.assertExists();
    return this.toProfile(clinic);
  }

  async update(dto: UpdateClinicDto): Promise<ClinicProfile> {
    const existing = await this.assertExists();
    const clinic = await this.prisma.clinic.update({ where: { id: existing.id }, data: dto });
    return this.toProfile(clinic);
  }

  async setLogo(logoPath: string): Promise<ClinicProfile> {
    const existing = await this.assertExists();
    const clinic = await this.prisma.clinic.update({ where: { id: existing.id }, data: { logoPath } });
    return this.toProfile(clinic);
  }

  async setLetterhead(letterheadPath: string): Promise<ClinicProfile> {
    const existing = await this.assertExists();
    const clinic = await this.prisma.clinic.update({ where: { id: existing.id }, data: { letterheadPath } });
    return this.toProfile(clinic);
  }

  private async assertExists(): Promise<Clinic> {
    const clinic = await this.prisma.clinic.findFirst();
    if (!clinic) {
      throw new NotFoundException('Clinic profile not configured');
    }
    return clinic;
  }

  private toProfile(clinic: Clinic): ClinicProfile {
    return {
      id: clinic.id,
      name: clinic.name,
      address: clinic.address,
      phone: clinic.phone,
      email: clinic.email,
      doctorName: clinic.doctorName,
      degree: clinic.degree,
      regnNumber: clinic.regnNumber,
      logoPath: clinic.logoPath,
      letterheadPath: clinic.letterheadPath,
      openTime: clinic.openTime,
      closeTime: clinic.closeTime,
      slotMinutes: clinic.slotMinutes,
      taxEnabled: clinic.taxEnabled,
      taxLabel: clinic.taxLabel,
      gstNumber: clinic.gstNumber,
      discountEnabled: clinic.discountEnabled,
    };
  }
}
