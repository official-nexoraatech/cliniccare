import { Module } from '@nestjs/common';
import { MedicineFieldsService } from './medicine-fields.service';
import { MedicineFieldsController } from './medicine-fields.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [MedicineFieldsController],
  providers: [MedicineFieldsService],
})
export class MedicineFieldsModule {}
