import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AccountsService } from './accounts.service';
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
