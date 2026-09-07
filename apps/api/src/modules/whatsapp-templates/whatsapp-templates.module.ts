import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WhatsAppTemplatesController } from './whatsapp-templates.controller';
import { WhatsAppTemplatesService } from './whatsapp-templates.service';

@Module({
  imports: [AuthModule],
  controllers: [WhatsAppTemplatesController],
  providers: [WhatsAppTemplatesService],
})
export class WhatsAppTemplatesModule {}
