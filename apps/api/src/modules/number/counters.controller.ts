import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { NumberService } from './number.service';
import { UpdateCounterDto } from './dto/update-counter.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequiresPermission } from '../../common/decorators/requires-permission.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('counters')
export class CountersController {
  constructor(private readonly numberService: NumberService) {}

  @RequiresPermission('clinic:edit')
  @Get()
  list() {
    return this.numberService.listCounters();
  }

  @RequiresPermission('clinic:edit')
  @Patch(':key')
  update(@Param('key') key: string, @Body() dto: UpdateCounterDto) {
    return this.numberService.updateCounter(key, dto);
  }
}
