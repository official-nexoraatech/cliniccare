import { Module } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { AuthModule } from '../auth/auth.module';
import { VisitsModule } from '../visits/visits.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [AuthModule, VisitsModule, BillingModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
})
export class AppointmentsModule {}
