import { Module } from '@nestjs/common';
import { VisitFieldsService } from './visit-fields.service';
import { VisitFieldsController } from './visit-fields.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [VisitFieldsController],
  providers: [VisitFieldsService],
})
export class VisitFieldsModule {}
