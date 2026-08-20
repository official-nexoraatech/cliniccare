import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { PatientsModule } from './modules/patients/patients.module';
import { MedicinesModule } from './modules/medicines/medicines.module';
import { VisitsModule } from './modules/visits/visits.module';
import { PrescriptionsModule } from './modules/prescriptions/prescriptions.module';
import { ClinicModule } from './modules/clinic/clinic.module';
import { FeeTypesModule } from './modules/fee-types/fee-types.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { FollowUpsModule } from './modules/followups/followups.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { CertificatesModule } from './modules/certificates/certificates.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    RolesModule,
    PatientsModule,
    MedicinesModule,
    VisitsModule,
    PrescriptionsModule,
    ClinicModule,
    FeeTypesModule,
    DocumentsModule,
    ComplianceModule,
    FollowUpsModule,
    AppointmentsModule,
    CertificatesModule,
  ],
})
export class AppModule {}
