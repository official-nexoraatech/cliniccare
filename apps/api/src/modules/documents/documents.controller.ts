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
import { diskStorage } from 'multer';
import { extname, join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import type { Express } from 'express';
import { DocumentsService } from './documents.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequiresPermission } from '../../common/decorators/requires-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/guards/jwt-auth.guard';

const DOCUMENTS_DIR = join(process.cwd(), 'files', 'documents');
const ALLOWED_TYPES = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf']);

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
      storage: diskStorage({
        destination: (_req, _file, callback) => {
          if (!existsSync(DOCUMENTS_DIR)) {
            mkdirSync(DOCUMENTS_DIR, { recursive: true });
          }
          callback(null, DOCUMENTS_DIR);
        },
        filename: (req, file, callback) => {
          const patientId = (req.body as { patientId?: string }).patientId ?? 'unknown';
          callback(null, `${patientId}-${Date.now()}${extname(file.originalname).toLowerCase()}`);
        },
      }),
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
        filePath: `/files/documents/${file.filename}`,
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
