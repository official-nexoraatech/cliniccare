import { Module } from '@nestjs/common';
import { VisitsService } from './visits.service';
import { VisitsController } from './visits.controller';
import { LabTestsController } from './lab-tests.controller';
import { AuthModule } from '../auth/auth.module';
import { NumberModule } from '../number/number.module';

@Module({
  imports: [AuthModule, NumberModule],
  controllers: [VisitsController, LabTestsController],
  providers: [VisitsService],
})
export class VisitsModule {}
