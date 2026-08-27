import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'node:path';
import type { Express } from 'express';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { ListPatientsQueryDto } from './dto/list-patients-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequiresPermission } from '../../common/decorators/requires-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/guards/jwt-auth.guard';

const ALLOWED_PHOTO_TYPES = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const toDataUrl = (file: Express.Multer.File): string =>
  `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @RequiresPermission('patients:view')
  @Get()
  list(@Query() query: ListPatientsQueryDto) {
    return this.patientsService.list(query);
  }

  @RequiresPermission('patients:view')
  @Get('search')
  search(@Query('q') q: string) {
    return this.patientsService.search(q ?? '');
  }

  @RequiresPermission('patients:view')
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.patientsService.getById(id);
  }

  @RequiresPermission('patients:view')
  @Get(':id/history')
  getHistory(@Param('id') id: string) {
    return this.patientsService.getHistory(id);
  }

  @RequiresPermission('patients:edit')
  @Post()
  create(@Body() dto: CreatePatientDto, @CurrentUser() user: RequestUser) {
    return this.patientsService.create(dto, user.id);
  }

  @RequiresPermission('patients:edit')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePatientDto) {
    return this.patientsService.update(id, dto);
  }

  @RequiresPermission('patients:edit')
  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.patientsService.deactivate(id);
  }

  @RequiresPermission('patients:edit')
  @Patch(':id/reactivate')
  reactivate(@Param('id') id: string) {
    return this.patientsService.reactivate(id);
  }

  @RequiresPermission('patients:edit')
  @Post(':id/photo')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        const ext = extname(file.originalname).toLowerCase();
        if (!ALLOWED_PHOTO_TYPES.has(ext)) {
          callback(new BadRequestException('Only JPG, PNG or WEBP images are allowed'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  uploadPhoto(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No photo file was uploaded');
    }
    return this.patientsService.setPhoto(id, toDataUrl(file));
  }
}
