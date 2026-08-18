import { Module } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { PatientsController } from './patients.controller';
import { AuthModule } from '../auth/auth.module';
import { NumberModule } from '../number/number.module';
import { DocumentsModule } from '../documents/documents.module';

@Module({
  imports: [AuthModule, NumberModule, DocumentsModule],
  controllers: [PatientsController],
  providers: [PatientsService],
})
export class PatientsModule {}
