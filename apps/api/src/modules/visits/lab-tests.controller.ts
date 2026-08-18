import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { VisitsService } from './visits.service';
import { EnterLabResultDto } from './dto/enter-lab-result.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequiresPermission } from '../../common/decorators/requires-permission.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('lab-tests')
export class LabTestsController {
  constructor(private readonly visitsService: VisitsService) {}

  @RequiresPermission('visits:edit')
  @Patch(':id/result')
  enterResult(@Param('id') id: string, @Body() dto: EnterLabResultDto) {
    return this.visitsService.enterLabResult(id, dto);
  }
}
