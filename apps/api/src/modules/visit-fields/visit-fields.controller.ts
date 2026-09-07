import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { VisitFieldsService } from './visit-fields.service';
import { CreateVisitFieldDto } from './dto/create-visit-field.dto';
import { UpdateVisitFieldDto } from './dto/update-visit-field.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequiresPermission } from '../../common/decorators/requires-permission.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('visit-fields')
export class VisitFieldsController {
  constructor(private readonly visitFieldsService: VisitFieldsService) {}

  @Get()
  list() {
    return this.visitFieldsService.list();
  }

  @RequiresPermission('visits:edit')
  @Post()
  create(@Body() dto: CreateVisitFieldDto) {
    return this.visitFieldsService.create(dto);
  }

  @RequiresPermission('visits:edit')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVisitFieldDto) {
    return this.visitFieldsService.update(id, dto);
  }

  @RequiresPermission('visits:edit')
  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.visitFieldsService.deactivate(id);
  }

  @RequiresPermission('visits:edit')
  @Patch(':id/reactivate')
  reactivate(@Param('id') id: string) {
    return this.visitFieldsService.reactivate(id);
  }
}
