import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { FeeTypesService } from './fee-types.service';
import { CreateFeeTypeDto } from './dto/create-fee-type.dto';
import { UpdateFeeTypeDto } from './dto/update-fee-type.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequiresPermission } from '../../common/decorators/requires-permission.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('fee-types')
export class FeeTypesController {
  constructor(private readonly feeTypesService: FeeTypesService) {}

  // Open to any authenticated user — a future billing screen needs to read the fee
  // list to build a receipt, not just the admin who configures it.
  @Get()
  list() {
    return this.feeTypesService.list();
  }

  @RequiresPermission('clinic:edit')
  @Post()
  create(@Body() dto: CreateFeeTypeDto) {
    return this.feeTypesService.create(dto);
  }

  @RequiresPermission('clinic:edit')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFeeTypeDto) {
    return this.feeTypesService.update(id, dto);
  }

  @RequiresPermission('clinic:edit')
  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.feeTypesService.deactivate(id);
  }

  @RequiresPermission('clinic:edit')
  @Patch(':id/reactivate')
  reactivate(@Param('id') id: string) {
    return this.feeTypesService.reactivate(id);
  }
}
