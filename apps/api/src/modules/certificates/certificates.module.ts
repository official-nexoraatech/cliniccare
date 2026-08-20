import { Module } from '@nestjs/common';
import { CertificatesService } from './certificates.service';
import { CertificatesController } from './certificates.controller';
import { AuthModule } from '../auth/auth.module';
import { NumberModule } from '../number/number.module';

@Module({
  imports: [AuthModule, NumberModule],
  controllers: [CertificatesController],
  providers: [CertificatesService],
})
export class CertificatesModule {}
