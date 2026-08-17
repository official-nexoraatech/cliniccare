import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { VisitsService } from './visits.service';
import { CreateVisitDto } from './dto/create-visit.dto';
import { UpdateVisitDto } from './dto/update-visit.dto';
import { SaveVitalsDto } from './dto/save-vitals.dto';
import { AdviseLabTestsDto } from './dto/advise-lab-tests.dto';
import { EnterLabResultDto } from './dto/enter-lab-result.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('visits')
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Get('today')
  listToday() {
    return this.visitsService.listToday();
  }

  @Get('patient/:patientId')
  listByPatient(@Param('patientId') patientId: string) {
    return this.visitsService.listByPatient(patientId);
  }

  @Get('suggestions/complaint')
  suggestComplaints(@Query('q') q: string) {
    return this.visitsService.suggestComplaints(q ?? '');
  }

  @Get('suggestions/diagnosis')
  suggestDiagnoses(@Query('q') q: string) {
    return this.visitsService.suggestDiagnoses(q ?? '');
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.visitsService.getById(id);
  }

  @Post()
  create(@Body() dto: CreateVisitDto, @CurrentUser() user: RequestUser) {
    return this.visitsService.create(dto, user.id, user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVisitDto) {
    return this.visitsService.update(id, dto);
  }

  @Patch(':id/start')
  start(@Param('id') id: string) {
    return this.visitsService.start(id);
  }

  @Post(':id/vitals')
  saveVitals(@Param('id') id: string, @Body() dto: SaveVitalsDto) {
    return this.visitsService.saveVitals(id, dto);
  }

  @Post(':id/lab-tests')
  adviseLabTests(@Param('id') id: string, @Body() dto: AdviseLabTestsDto) {
    return this.visitsService.adviseLabTests(id, dto);
  }
}
