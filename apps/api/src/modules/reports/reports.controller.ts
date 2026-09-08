import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequiresPermission } from '../../common/decorators/requires-permission.decorator';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @RequiresPermission('billing:view')
  @Get('revenue-trend')
  getRevenueTrend(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.getRevenueTrend(from ?? daysAgoIso(29), to ?? todayIso());
  }

  @RequiresPermission('visits:view')
  @Get('patient-footfall')
  getPatientFootfall(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.getPatientFootfall(from ?? daysAgoIso(29), to ?? todayIso());
  }

  @RequiresPermission('appointments:view')
  @Get('appointment-funnel')
  getAppointmentFunnel(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.getAppointmentFunnel(from ?? daysAgoIso(29), to ?? todayIso());
  }

  @RequiresPermission('medicines:view')
  @Get('top-medicines')
  getTopMedicines(@Query('limit') limit?: string) {
    return this.reportsService.getTopMedicines(limit ? Number(limit) : 10);
  }
}
