import { Module } from '@nestjs/common';
import { PatientFieldsService } from './patient-fields.service';
import { PatientFieldsController } from './patient-fields.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [PatientFieldsController],
  providers: [PatientFieldsService],
})
export class PatientFieldsModule {}
