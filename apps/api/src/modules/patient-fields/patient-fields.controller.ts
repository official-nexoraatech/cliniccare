import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PatientFieldsService } from './patient-fields.service';
import { CreatePatientFieldDto } from './dto/create-patient-field.dto';
import { UpdatePatientFieldDto } from './dto/update-patient-field.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequiresPermission } from '../../common/decorators/requires-permission.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('patient-fields')
export class PatientFieldsController {
  constructor(private readonly patientFieldsService: PatientFieldsService) {}

  // Open to any authenticated user — the patient registration/edit form reads this
  // list to know which extra fields to render, not just the admin who configures them.
  @Get()
  list() {
    return this.patientFieldsService.list();
  }

  @RequiresPermission('clinic:edit')
  @Post()
  create(@Body() dto: CreatePatientFieldDto) {
    return this.patientFieldsService.create(dto);
  }

  @RequiresPermission('clinic:edit')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePatientFieldDto) {
    return this.patientFieldsService.update(id, dto);
  }

  @RequiresPermission('clinic:edit')
  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.patientFieldsService.deactivate(id);
  }

  @RequiresPermission('clinic:edit')
  @Patch(':id/reactivate')
  reactivate(@Param('id') id: string) {
    return this.patientFieldsService.reactivate(id);
  }
}
