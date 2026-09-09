import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { CreatePaymentAccountDto } from './dto/create-payment-account.dto';
import { UpdatePaymentAccountDto } from './dto/update-payment-account.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequiresPermission } from '../../common/decorators/requires-permission.decorator';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @RequiresPermission('billing:view')
  @Get('payment-accounts')
  getPaymentAccounts() {
    return this.accountsService.listPaymentAccounts();
  }

  @RequiresPermission('billing:edit')
  @Post('payment-accounts')
  createPaymentAccount(@Body() dto: CreatePaymentAccountDto) {
    return this.accountsService.createPaymentAccount(dto);
  }

  @RequiresPermission('billing:edit')
  @Patch('payment-accounts/:id')
  updatePaymentAccount(@Param('id') id: string, @Body() dto: UpdatePaymentAccountDto) {
    return this.accountsService.updatePaymentAccount(id, dto);
  }

  @RequiresPermission('billing:edit')
  @Delete('payment-accounts/:id')
  softDeletePaymentAccount(@Param('id') id: string) {
    return this.accountsService.deactivatePaymentAccount(id);
  }

  @RequiresPermission('billing:view')
  @Get('summary')
  getSummary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.accountsService.getSummary(from ?? todayIso(), to ?? todayIso());
  }

  @RequiresPermission('billing:view')
  @Get('dues')
  getDues() {
    return this.accountsService.getOutstandingDues();
  }

  @RequiresPermission('billing:view')
  @Get('daybook')
  getDaybook(@Query('date') date?: string) {
    return this.accountsService.getDaybook(date ?? todayIso());
  }
}
