import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { BillingService } from './billing.service';
import { CreateBillDto } from './dto/create-bill.dto';
import { UpdateBillDto } from './dto/update-bill.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { CancelBillDto } from './dto/cancel-bill.dto';
import { BillItemDto } from './dto/bill-item.dto';
import { RemoveBillItemDto } from './dto/remove-bill-item.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequiresPermission } from '../../common/decorators/requires-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @RequiresPermission('billing:view')
  @Get()
  list(@Query('status') status?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.billingService.list({ status, from, to });
  }

  @RequiresPermission('billing:view')
  @Get('patient/:patientId')
  listByPatient(@Param('patientId') patientId: string) {
    return this.billingService.listByPatient(patientId);
  }

  @RequiresPermission('billing:view')
  @Get('visit/:visitId')
  getByVisit(@Param('visitId') visitId: string) {
    return this.billingService.getByVisit(visitId);
  }

  @RequiresPermission('billing:view')
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.billingService.getById(id);
  }

  @RequiresPermission('billing:edit')
  @Post()
  create(@Body() dto: CreateBillDto, @CurrentUser() user: RequestUser) {
    return this.billingService.create(dto, user.username, { id: user.username, role: user.role });
  }

  @RequiresPermission('billing:edit')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBillDto) {
    return this.billingService.update(id, dto);
  }

  // Unlike update() above, allowed at any time — including after payments exist — so a
  // charge that only becomes known partway through a visit (an injection, dressing, etc.)
  // can be added to the same bill instead of being stuck with no way to bill it at all.
  @RequiresPermission('billing:edit')
  @Post(':id/items')
  addItem(@Param('id') id: string, @Body() dto: BillItemDto, @CurrentUser() user: RequestUser) {
    return this.billingService.addItem(id, dto, { id: user.username, role: user.role });
  }

  @RequiresPermission('billing:edit')
  @Patch(':id/items/:itemId/cancel')
  cancelItem(@Param('id') id: string, @Param('itemId') itemId: string, @Body() dto: RemoveBillItemDto, @CurrentUser() user: RequestUser) {
    return this.billingService.cancelItem(id, itemId, dto.reason, { id: user.username, role: user.role });
  }

  @RequiresPermission('billing:edit')
  @Patch(':id/items/:itemId/waive')
  waiveItem(@Param('id') id: string, @Param('itemId') itemId: string, @Body() dto: RemoveBillItemDto, @CurrentUser() user: RequestUser) {
    return this.billingService.waiveItem(id, itemId, dto.reason, { id: user.username, role: user.role });
  }

  @RequiresPermission('billing:edit')
  @Post(':id/payments')
  recordPayment(@Param('id') id: string, @Body() dto: RecordPaymentDto, @CurrentUser() user: RequestUser) {
    return this.billingService.recordPayment(id, dto, user.username);
  }

  @RequiresPermission('billing:edit')
  @Post(':id/print')
  markPrinted(@Param('id') id: string) {
    return this.billingService.markPrinted(id);
  }

  @RequiresPermission('billing:edit')
  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @Body() dto: CancelBillDto, @CurrentUser() user: RequestUser) {
    return this.billingService.cancel(id, dto, { id: user.username, role: user.role });
  }
}
