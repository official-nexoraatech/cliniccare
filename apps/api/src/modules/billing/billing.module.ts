import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { AuthModule } from '../auth/auth.module';
import { NumberModule } from '../number/number.module';
import { AccountsModule } from '../accounts/accounts.module';

@Module({
  imports: [AuthModule, NumberModule, AccountsModule],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
