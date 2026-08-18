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
import { diskStorage } from 'multer';
import { extname, join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import type { Express } from 'express';
import { ClinicService } from './clinic.service';
import { UpdateClinicDto } from './dto/update-clinic.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequiresPermission } from '../../common/decorators/requires-permission.decorator';

const BRANDING_DIR = join(process.cwd(), 'files', 'clinic');
const ALLOWED_IMAGE_TYPES = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const brandingUpload = (field: string) =>
  FileInterceptor(field, {
    storage: diskStorage({
      destination: (_req, _file, callback) => {
        if (!existsSync(BRANDING_DIR)) {
          mkdirSync(BRANDING_DIR, { recursive: true });
        }
        callback(null, BRANDING_DIR);
      },
      filename: (_req, file, callback) => {
        callback(null, `${field}-${Date.now()}${extname(file.originalname).toLowerCase()}`);
      },
    }),
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
    return this.clinicService.setLogo(`/files/clinic/${file.filename}`);
  }

  @UseGuards(PermissionsGuard)
  @RequiresPermission('clinic:edit')
  @Post('letterhead')
  @UseInterceptors(brandingUpload('letterhead'))
  uploadLetterhead(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No letterhead file was uploaded');
    }
    return this.clinicService.setLetterhead(`/files/clinic/${file.filename}`);
  }
}
