import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { MedicineFieldsService } from './medicine-fields.service';
import { CreateMedicineFieldDto } from './dto/create-medicine-field.dto';
import { UpdateMedicineFieldDto } from './dto/update-medicine-field.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequiresPermission } from '../../common/decorators/requires-permission.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('medicine-fields')
export class MedicineFieldsController {
  constructor(private readonly medicineFieldsService: MedicineFieldsService) {}

  // Open to any authenticated user — the medicine add/edit form reads this list to
  // know which extra fields to render, not just the admin who configures them.
  @Get()
  list() {
    return this.medicineFieldsService.list();
  }

  @RequiresPermission('medicines:edit')
  @Post()
  create(@Body() dto: CreateMedicineFieldDto) {
    return this.medicineFieldsService.create(dto);
  }

  @RequiresPermission('medicines:edit')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMedicineFieldDto) {
    return this.medicineFieldsService.update(id, dto);
  }

  @RequiresPermission('medicines:edit')
  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.medicineFieldsService.deactivate(id);
  }

  @RequiresPermission('medicines:edit')
  @Patch(':id/reactivate')
  reactivate(@Param('id') id: string) {
    return this.medicineFieldsService.reactivate(id);
  }
}
