import { Injectable, NotFoundException } from '@nestjs/common';
import type { Document } from '@prisma/client';
import type { DocumentDetail } from '@clinic-care/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { UploadDocumentDto } from './dto/upload-document.dto';

interface UploadedFileInfo {
  filePath: string;
  fileType: string;
  fileSize: number;
  fileName: string;
}

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async listByPatient(patientId: string): Promise<DocumentDetail[]> {
    const documents = await this.prisma.document.findMany({
      where: { patientId },
      orderBy: { uploadedOn: 'desc' },
    });
    return documents.map((doc) => this.toDetail(doc));
  }

  async upload(dto: UploadDocumentDto, file: UploadedFileInfo, uploadedBy?: string): Promise<DocumentDetail> {
    const document = await this.prisma.document.create({
      data: {
        patientId: dto.patientId,
        visitId: dto.visitId,
        category: dto.category ?? 'OTHER',
        description: dto.description,
        fileName: file.fileName,
        filePath: file.filePath,
        fileType: file.fileType,
        fileSize: file.fileSize,
        uploadedBy,
      },
    });
    return this.toDetail(document);
  }

  async remove(id: string): Promise<void> {
    const exists = await this.prisma.document.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      throw new NotFoundException('Document not found');
    }
    await this.prisma.document.delete({ where: { id } });
  }

  private toDetail(document: Document): DocumentDetail {
    return {
      id: document.id,
      patientId: document.patientId,
      visitId: document.visitId,
      fileName: document.fileName,
      filePath: document.filePath,
      fileType: document.fileType,
      fileSize: document.fileSize,
      category: document.category as DocumentDetail['category'],
      description: document.description,
      uploadedOn: document.uploadedOn.toISOString(),
    };
  }
}
