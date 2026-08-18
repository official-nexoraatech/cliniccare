import { Module } from '@nestjs/common';
import { NumberService } from './number.service';
import { CountersController } from './counters.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CountersController],
  providers: [NumberService],
  exports: [NumberService],
})
export class NumberModule {}
