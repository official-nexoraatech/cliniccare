import { Module } from '@nestjs/common';
import { VisitsService } from './visits.service';
import { VisitsController } from './visits.controller';
import { LabTestsController } from './lab-tests.controller';
import { AuthModule } from '../auth/auth.module';
import { NumberModule } from '../number/number.module';
import { FollowUpsModule } from '../followups/followups.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [AuthModule, NumberModule, FollowUpsModule, BillingModule],
  controllers: [VisitsController, LabTestsController],
  providers: [VisitsService],
  exports: [VisitsService],
})
export class VisitsModule {}
