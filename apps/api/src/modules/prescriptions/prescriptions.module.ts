import { Module } from '@nestjs/common';
import { PrescriptionsService } from './prescriptions.service';
import { PrescriptionsController } from './prescriptions.controller';
import { DoseService } from './dose.service';
import { AuthModule } from '../auth/auth.module';
import { MedicinesModule } from '../medicines/medicines.module';

@Module({
  imports: [AuthModule, MedicinesModule],
  controllers: [PrescriptionsController],
  providers: [PrescriptionsService, DoseService],
})
export class PrescriptionsModule {}
