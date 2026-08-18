import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { MedicinesService } from './medicines.service';
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';
import { ListMedicinesQueryDto } from './dto/list-medicines-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequiresPermission } from '../../common/decorators/requires-permission.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('medicines')
export class MedicinesController {
  constructor(private readonly medicinesService: MedicinesService) {}

  @RequiresPermission('medicines:view')
  @Get()
  list(@Query() query: ListMedicinesQueryDto) {
    return this.medicinesService.list(query);
  }

  @RequiresPermission('medicines:view')
  @Get('search')
  search(@Query('q') q: string) {
    return this.medicinesService.search(q ?? '');
  }

  @RequiresPermission('medicines:view')
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.medicinesService.getById(id);
  }

  @RequiresPermission('medicines:edit')
  @Post()
  create(@Body() dto: CreateMedicineDto) {
    return this.medicinesService.create(dto);
  }

  @RequiresPermission('medicines:edit')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMedicineDto) {
    return this.medicinesService.update(id, dto);
  }

  @RequiresPermission('medicines:edit')
  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.medicinesService.deactivate(id);
  }

  @RequiresPermission('medicines:edit')
  @Patch(':id/reactivate')
  reactivate(@Param('id') id: string) {
    return this.medicinesService.reactivate(id);
  }

  @RequiresPermission('medicines:edit')
  @Patch(':id/favourite')
  toggleFavourite(@Param('id') id: string) {
    return this.medicinesService.toggleFavourite(id);
  }
}
