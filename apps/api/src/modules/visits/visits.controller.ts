import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { VisitsService } from './visits.service';
import { CreateVisitDto } from './dto/create-visit.dto';
import { UpdateVisitDto } from './dto/update-visit.dto';
import { SaveVitalsDto } from './dto/save-vitals.dto';
import { AdviseLabTestsDto } from './dto/advise-lab-tests.dto';
import { EnterLabResultDto } from './dto/enter-lab-result.dto';
import { BillItemDto } from '../billing/dto/bill-item.dto';
import { AddBillableChargesDto } from './dto/add-billable-charges.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequiresPermission } from '../../common/decorators/requires-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('visits')
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @RequiresPermission('visits:view')
  @Get('today')
  listToday() {
    return this.visitsService.listToday();
  }

  @RequiresPermission('visits:view')
  @Get('patient/:patientId')
  listByPatient(@Param('patientId') patientId: string) {
    return this.visitsService.listByPatient(patientId);
  }

  @RequiresPermission('visits:view')
  @Get('suggestions/complaint')
  suggestComplaints(@Query('q') q: string) {
    return this.visitsService.suggestComplaints(q ?? '');
  }

  @RequiresPermission('visits:view')
  @Get('suggestions/diagnosis')
  suggestDiagnoses(@Query('q') q: string) {
    return this.visitsService.suggestDiagnoses(q ?? '');
  }

  @RequiresPermission('visits:view')
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.visitsService.getById(id);
  }

  @RequiresPermission('visits:edit')
  @Post()
  create(@Body() dto: CreateVisitDto, @CurrentUser() user: RequestUser) {
    return this.visitsService.create(dto, user.id, user.id);
  }

  @RequiresPermission('visits:edit')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVisitDto) {
    return this.visitsService.update(id, dto);
  }

  @RequiresPermission('visits:edit')
  @Patch(':id/start')
  start(@Param('id') id: string) {
    return this.visitsService.start(id);
  }

  // Narrower than visits:edit on purpose — a nurse/assistant records vitals before the
  // doctor ever opens the visit, without gaining rights to diagnose or prescribe.
  @RequiresPermission('vitals:edit')
  @Post(':id/vitals')
  saveVitals(@Param('id') id: string, @Body() dto: SaveVitalsDto) {
    return this.visitsService.saveVitals(id, dto);
  }

  @RequiresPermission('visits:edit')
  @Post(':id/lab-tests')
  adviseLabTests(@Param('id') id: string, @Body() dto: AdviseLabTestsDto) {
    return this.visitsService.adviseLabTests(id, dto);
  }

  // Narrower than visits:edit — lets a doctor OR nurse add a charge to the visit's
  // running bill without granting the rest of visits:edit (diagnosis, prescriptions, ...).
  @RequiresPermission('billing-charges:edit')
  @Post(':id/bill-items')
  addBillableCharge(@Param('id') id: string, @Body() dto: BillItemDto, @CurrentUser() user: RequestUser) {
    return this.visitsService.addBillableCharge(id, dto, user.username, { id: user.username, role: user.role });
  }

  @RequiresPermission('billing-charges:edit')
  @Post(':id/bill-items/bulk')
  addBillableCharges(@Param('id') id: string, @Body() dto: AddBillableChargesDto, @CurrentUser() user: RequestUser) {
    return this.visitsService.addBillableCharges(id, dto, user.username, { id: user.username, role: user.role });
  }
}
