import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { BackupService } from './backup.service';
import { UpdateBackupSettingsDto } from './dto/update-backup-settings.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequiresPermission } from '../../common/decorators/requires-permission.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('backup')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @RequiresPermission('administration:view')
  @Get('status')
  getStatus() {
    return this.backupService.getStatus();
  }

  @RequiresPermission('administration:edit')
  @Patch('settings')
  updateSettings(@Body() dto: UpdateBackupSettingsDto) {
    return this.backupService.updateSettings(dto);
  }

  @RequiresPermission('administration:edit')
  @Post('run')
  runNow() {
    return this.backupService.runNow();
  }

  @RequiresPermission('administration:view')
  @Get('restore-preview')
  getRestorePreview() {
    return this.backupService.getRestorePreview();
  }

  @RequiresPermission('administration:edit')
  @Post('restore')
  restoreFromAtlas() {
    return this.backupService.restoreFromAtlas();
  }
}
