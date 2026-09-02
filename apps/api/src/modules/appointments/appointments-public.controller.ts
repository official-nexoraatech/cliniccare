import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { RespondToReminderDto } from './dto/respond-to-reminder.dto';

// Deliberately unauthenticated (no JwtAuthGuard) — reached from a WhatsApp reminder link
// a patient taps on their own phone, with no login session. Scoped to a single
// appointment by its unguessable cuid id and exposes only what the Yes/No confirmation
// screen needs, never the full appointment or patient record.
@Controller('public/appointments')
export class AppointmentsPublicController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get(':id')
  getSummary(@Param('id') id: string) {
    return this.appointmentsService.getPublicSummary(id);
  }

  @Post(':id/respond')
  respond(@Param('id') id: string, @Body() dto: RespondToReminderDto) {
    return this.appointmentsService.respondToReminder(id, dto.response);
  }
}
