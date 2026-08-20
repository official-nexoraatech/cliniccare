import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CertificatesService } from './certificates.service';
import { IssueCertificateDto } from './dto/issue-certificate.dto';
import { CancelCertificateDto } from './dto/cancel-certificate.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequiresPermission } from '../../common/decorators/requires-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('certificates')
export class CertificatesController {
  constructor(private readonly certificatesService: CertificatesService) {}

  @RequiresPermission('prescriptions:view')
  @Get()
  list() {
    return this.certificatesService.list();
  }

  @RequiresPermission('prescriptions:view')
  @Get('patient/:patientId')
  listByPatient(@Param('patientId') patientId: string) {
    return this.certificatesService.listByPatient(patientId);
  }

  @RequiresPermission('prescriptions:view')
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.certificatesService.getById(id);
  }

  @RequiresPermission('prescriptions:edit')
  @Post()
  issue(@Body() dto: IssueCertificateDto, @CurrentUser() user: RequestUser) {
    return this.certificatesService.issue(dto, user.username);
  }

  @RequiresPermission('prescriptions:edit')
  @Post(':id/print')
  markPrinted(@Param('id') id: string) {
    return this.certificatesService.markPrinted(id);
  }

  @RequiresPermission('prescriptions:edit')
  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @Body() dto: CancelCertificateDto) {
    return this.certificatesService.cancel(id, dto);
  }
}
