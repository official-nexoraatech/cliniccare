import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { FollowUpsService } from './followups.service';
import { MarkContactedDto } from './dto/mark-contacted.dto';
import { RescheduleFollowUpDto } from './dto/reschedule-follow-up.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequiresPermission } from '../../common/decorators/requires-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('follow-ups')
export class FollowUpsController {
  constructor(private readonly followUpsService: FollowUpsService) {}

  @RequiresPermission('patients:view')
  @Get('counts')
  getCounts() {
    return this.followUpsService.getCounts();
  }

  @RequiresPermission('patients:view')
  @Get('due')
  getDueToday() {
    return this.followUpsService.getDueToday();
  }

  @RequiresPermission('patients:view')
  @Get('overdue')
  getOverdue() {
    return this.followUpsService.getOverdue();
  }

  @RequiresPermission('patients:view')
  @Get('upcoming')
  getUpcoming(@Query('days') days?: string) {
    return this.followUpsService.getUpcoming(days ? Number(days) : 7);
  }

  @RequiresPermission('patients:view')
  @Get('call-list')
  getCallList() {
    return this.followUpsService.getCallList();
  }

  @RequiresPermission('patients:view')
  @Get('missed')
  getMissedThisMonth() {
    return this.followUpsService.getMissedThisMonth();
  }

  @RequiresPermission('patients:view')
  @Get('patient/:patientId')
  getForPatient(@Param('patientId') patientId: string) {
    return this.followUpsService.getForPatient(patientId);
  }

  @RequiresPermission('patients:edit')
  @Patch(':id/contacted')
  markContacted(@Param('id') id: string, @Body() dto: MarkContactedDto, @CurrentUser() user: RequestUser) {
    return this.followUpsService.markContacted(id, dto, user.id);
  }

  @RequiresPermission('patients:edit')
  @Patch(':id/reschedule')
  reschedule(@Param('id') id: string, @Body() dto: RescheduleFollowUpDto) {
    return this.followUpsService.reschedule(id, dto);
  }

  @RequiresPermission('patients:edit')
  @Patch(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.followUpsService.cancel(id);
  }
}
