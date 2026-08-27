import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'node:path';
import type { Express } from 'express';
import { DocumentsService } from './documents.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequiresPermission } from '../../common/decorators/requires-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/guards/jwt-auth.guard';

const ALLOWED_TYPES = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf']);

const toDataUrl = (file: Express.Multer.File): string =>
  `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @RequiresPermission('patients:view')
  @Get('patient/:patientId')
  listByPatient(@Param('patientId') patientId: string) {
    return this.documentsService.listByPatient(patientId);
  }

  @RequiresPermission('patients:edit')
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        const ext = extname(file.originalname).toLowerCase();
        if (!ALLOWED_TYPES.has(ext)) {
          callback(new BadRequestException('Only JPG, PNG, WEBP or PDF files are allowed'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  upload(
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: RequestUser,
  ) {
    if (!file) {
      throw new BadRequestException('No file was uploaded');
    }
    return this.documentsService.upload(
      dto,
      {
        fileName: file.originalname,
        filePath: toDataUrl(file),
        fileType: file.mimetype,
        fileSize: file.size,
      },
      user.id,
    );
  }

  @RequiresPermission('patients:edit')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.documentsService.remove(id);
  }
}
