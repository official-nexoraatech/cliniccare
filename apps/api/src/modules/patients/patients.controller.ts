import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { ListPatientsQueryDto } from './dto/list-patients-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequiresPermission } from '../../common/decorators/requires-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @RequiresPermission('patients:view')
  @Get()
  list(@Query() query: ListPatientsQueryDto) {
    return this.patientsService.list(query);
  }

  @RequiresPermission('patients:view')
  @Get('search')
  search(@Query('q') q: string) {
    return this.patientsService.search(q ?? '');
  }

  @RequiresPermission('patients:view')
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.patientsService.getById(id);
  }

  @RequiresPermission('patients:view')
  @Get(':id/history')
  getHistory(@Param('id') id: string) {
    return this.patientsService.getHistory(id);
  }

  @RequiresPermission('patients:edit')
  @Post()
  create(@Body() dto: CreatePatientDto, @CurrentUser() user: RequestUser) {
    return this.patientsService.create(dto, user.id);
  }

  @RequiresPermission('patients:edit')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePatientDto) {
    return this.patientsService.update(id, dto);
  }

  @RequiresPermission('patients:edit')
  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.patientsService.deactivate(id);
  }

  @RequiresPermission('patients:edit')
  @Patch(':id/reactivate')
  reactivate(@Param('id') id: string) {
    return this.patientsService.reactivate(id);
  }
}
