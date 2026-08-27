import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'node:path';
import type { Express } from 'express';
import { ClinicService } from './clinic.service';
import { UpdateClinicDto } from './dto/update-clinic.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequiresPermission } from '../../common/decorators/requires-permission.decorator';

const ALLOWED_IMAGE_TYPES = new Set(['.jpg', '.jpeg', '.png', '.webp']);

// Stored as a data: URL directly on the Clinic document instead of a disk path — Render's
// filesystem isn't persistent across redeploys, so an uploaded file would vanish on the next
// deploy. These are small (5MB cap) branding images, well under Mongo's 16MB document limit.
const brandingUpload = (field: string) =>
  FileInterceptor(field, {
    storage: memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, callback) => {
      const ext = extname(file.originalname).toLowerCase();
      if (!ALLOWED_IMAGE_TYPES.has(ext)) {
        callback(new BadRequestException('Only JPG, PNG or WEBP images are allowed'), false);
        return;
      }
      callback(null, true);
    },
  });

const toDataUrl = (file: Express.Multer.File): string =>
  `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

@UseGuards(JwtAuthGuard)
@Controller('clinic')
export class ClinicController {
  constructor(private readonly clinicService: ClinicService) {}

  @Get()
  getProfile() {
    return this.clinicService.getProfile();
  }

  @UseGuards(PermissionsGuard)
  @RequiresPermission('clinic:edit')
  @Patch()
  update(@Body() dto: UpdateClinicDto) {
    return this.clinicService.update(dto);
  }

  @UseGuards(PermissionsGuard)
  @RequiresPermission('clinic:edit')
  @Post('logo')
  @UseInterceptors(brandingUpload('logo'))
  uploadLogo(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No logo file was uploaded');
    }
    return this.clinicService.setLogo(toDataUrl(file));
  }

  @UseGuards(PermissionsGuard)
  @RequiresPermission('clinic:edit')
  @Post('letterhead')
  @UseInterceptors(brandingUpload('letterhead'))
  uploadLetterhead(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No letterhead file was uploaded');
    }
    return this.clinicService.setLetterhead(toDataUrl(file));
  }
}
