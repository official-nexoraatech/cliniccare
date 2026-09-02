import { Module } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsPublicController } from './appointments-public.controller';
import { AuthModule } from '../auth/auth.module';
import { VisitsModule } from '../visits/visits.module';

@Module({
  imports: [AuthModule, VisitsModule],
  controllers: [AppointmentsController, AppointmentsPublicController],
  providers: [AppointmentsService],
})
export class AppointmentsModule {}
