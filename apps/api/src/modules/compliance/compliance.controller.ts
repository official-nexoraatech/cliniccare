import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ComplianceService } from './compliance.service';
import { SaveComplianceDto } from './dto/save-compliance.dto';
import type { ComplianceGrade } from '@clinic-care/shared-types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequiresPermission } from '../../common/decorators/requires-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('compliance')
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @RequiresPermission('patients:view')
  @Get('context/:patientId')
  getContext(@Param('patientId') patientId: string) {
    return this.complianceService.getContext(patientId);
  }

  @RequiresPermission('patients:edit')
  @Post()
  record(@Body() dto: SaveComplianceDto, @CurrentUser() user: RequestUser) {
    return this.complianceService.record(dto, user.id);
  }

  @RequiresPermission('patients:view')
  @Get('patient/:patientId')
  getForPatient(@Param('patientId') patientId: string) {
    return this.complianceService.getForPatient(patientId);
  }

  @RequiresPermission('patients:view')
  @Get('report')
  getReport(@Query('grade') grade?: ComplianceGrade) {
    return this.complianceService.getReport(grade);
  }
}
