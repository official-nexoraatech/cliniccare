import { Module } from '@nestjs/common';
import { FeeTypesService } from './fee-types.service';
import { FeeTypesController } from './fee-types.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [FeeTypesController],
  providers: [FeeTypesService],
})
export class FeeTypesModule {}
