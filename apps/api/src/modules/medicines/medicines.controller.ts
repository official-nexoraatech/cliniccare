import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { MedicinesService } from './medicines.service';
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';
import { ListMedicinesQueryDto } from './dto/list-medicines-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

// Same deferred-permissions approach as Patients: open to any authenticated role
// until Day 14 applies the full per-role matrix once every screen exists.
@UseGuards(JwtAuthGuard)
@Controller('medicines')
export class MedicinesController {
  constructor(private readonly medicinesService: MedicinesService) {}

  @Get()
  list(@Query() query: ListMedicinesQueryDto) {
    return this.medicinesService.list(query);
  }

  @Get('search')
  search(@Query('q') q: string) {
    return this.medicinesService.search(q ?? '');
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.medicinesService.getById(id);
  }

  @Post()
  create(@Body() dto: CreateMedicineDto) {
    return this.medicinesService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMedicineDto) {
    return this.medicinesService.update(id, dto);
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.medicinesService.deactivate(id);
  }

  @Patch(':id/reactivate')
  reactivate(@Param('id') id: string) {
    return this.medicinesService.reactivate(id);
  }

  @Patch(':id/favourite')
  toggleFavourite(@Param('id') id: string) {
    return this.medicinesService.toggleFavourite(id);
  }
}
