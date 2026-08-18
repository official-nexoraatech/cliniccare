import { Module } from '@nestjs/common';
import { FollowUpsService } from './followups.service';
import { FollowUpsController } from './followups.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [FollowUpsController],
  providers: [FollowUpsService],
  exports: [FollowUpsService],
})
export class FollowUpsModule {}
