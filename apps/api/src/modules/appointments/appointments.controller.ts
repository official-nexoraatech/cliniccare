import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';
import { LinkPatientDto } from './dto/link-patient.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequiresPermission } from '../../common/decorators/requires-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @RequiresPermission('visits:edit')
  @Post()
  book(@Body() dto: CreateAppointmentDto, @CurrentUser() user: RequestUser) {
    return this.appointmentsService.book(dto, user.id);
  }

  @RequiresPermission('visits:view')
  @Get('doctors')
  listDoctors() {
    return this.appointmentsService.listDoctors();
  }

  @RequiresPermission('visits:view')
  @Get('search')
  search(@Query('q') q: string) {
    return this.appointmentsService.search(q ?? '');
  }

  @RequiresPermission('visits:view')
  @Get('patient/:patientId')
  getForPatient(@Param('patientId') patientId: string) {
    return this.appointmentsService.getForPatient(patientId);
  }

  @RequiresPermission('visits:view')
  @Get('day/:date')
  listByDay(@Param('date') date: string) {
    return this.appointmentsService.listByDay(date);
  }

  @RequiresPermission('visits:view')
  @Get('queue')
  getQueue() {
    return this.appointmentsService.getQueue();
  }

  @RequiresPermission('visits:edit')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAppointmentDto) {
    return this.appointmentsService.update(id, dto);
  }

  @RequiresPermission('visits:edit')
  @Patch(':id/reschedule')
  reschedule(@Param('id') id: string, @Body() dto: RescheduleAppointmentDto) {
    return this.appointmentsService.reschedule(id, dto);
  }

  @RequiresPermission('visits:edit')
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateAppointmentStatusDto) {
    return this.appointmentsService.updateStatus(id, dto.status, dto.reason);
  }

  @RequiresPermission('visits:edit')
  @Patch(':id/link-patient')
  linkPatient(@Param('id') id: string, @Body() dto: LinkPatientDto) {
    return this.appointmentsService.linkPatient(id, dto.patientId);
  }

  @RequiresPermission('visits:edit')
  @Post(':id/arrived')
  markArrived(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.appointmentsService.markArrived(id, user.id, user.id);
  }
}
