import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { WhatsAppTemplatesService } from './whatsapp-templates.service';
import { UpdateWhatsAppTemplatesDto } from './dto/update-whatsapp-templates.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequiresPermission } from '../../common/decorators/requires-permission.decorator';

@UseGuards(JwtAuthGuard)
@Controller('whatsapp-templates')
export class WhatsAppTemplatesController {
  constructor(private readonly whatsAppTemplatesService: WhatsAppTemplatesService) {}

  @Get()
  getTemplates() {
    return this.whatsAppTemplatesService.getTemplates();
  }

  @UseGuards(PermissionsGuard)
  @RequiresPermission('clinic:edit')
  @Patch()
  updateTemplates(@Body() dto: UpdateWhatsAppTemplatesDto) {
    return this.whatsAppTemplatesService.updateTemplates({
      templates: {
        ...(dto.templates ?? {}),
        ...(dto.appointmentReminder !== undefined ? { appointmentReminder: dto.appointmentReminder } : {}),
        ...(dto.queueConfirmation !== undefined ? { queueConfirmation: dto.queueConfirmation } : {}),
        ...(dto.followUpReminder !== undefined ? { followUpReminder: dto.followUpReminder } : {}),
      },
    });
  }
}
