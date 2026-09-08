import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
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
import { PatientFieldsModule } from './modules/patient-fields/patient-fields.module';
import { MedicineFieldsModule } from './modules/medicine-fields/medicine-fields.module';
import { VisitFieldsModule } from './modules/visit-fields/visit-fields.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { FollowUpsModule } from './modules/followups/followups.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { CertificatesModule } from './modules/certificates/certificates.module';
import { BillingModule } from './modules/billing/billing.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { HealthModule } from './modules/health/health.module';
import { BackupModule } from './modules/backup/backup.module';
import { WhatsAppTemplatesModule } from './modules/whatsapp-templates/whatsapp-templates.module';
import { ReportsModule } from './modules/reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
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
    PatientFieldsModule,
    MedicineFieldsModule,
    VisitFieldsModule,
    DocumentsModule,
    ComplianceModule,
    FollowUpsModule,
    AppointmentsModule,
    CertificatesModule,
    BillingModule,
    AccountsModule,
    HealthModule,
    BackupModule,
    WhatsAppTemplatesModule,
    ReportsModule,
  ],
})
export class AppModule {}
