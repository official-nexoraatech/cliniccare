import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { PrescriptionsService } from './prescriptions.service';
import { SavePrescriptionDto } from './dto/save-prescription.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequiresPermission } from '../../common/decorators/requires-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('prescriptions')
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  @RequiresPermission('prescriptions:view')
  @Get('visit/:visitId')
  getByVisit(@Param('visitId') visitId: string) {
    return this.prescriptionsService.getByVisit(visitId);
  }

  @RequiresPermission('prescriptions:view')
  @Get('last/:patientId')
  getLast(@Param('patientId') patientId: string, @Query('excludeVisitId') excludeVisitId?: string) {
    return this.prescriptionsService.getLast(patientId, excludeVisitId ?? '');
  }

  @RequiresPermission('prescriptions:view')
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.prescriptionsService.getById(id);
  }

  @RequiresPermission('prescriptions:edit')
  @Post('visit/:visitId')
  save(@Param('visitId') visitId: string, @Body() dto: SavePrescriptionDto, @CurrentUser() user: RequestUser) {
    return this.prescriptionsService.save(visitId, dto, user.id);
  }

  @RequiresPermission('prescriptions:edit')
  @Post(':id/print')
  markPrinted(@Param('id') id: string) {
    return this.prescriptionsService.markPrinted(id);
  }
}
