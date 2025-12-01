import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { GridFSBucket, ObjectId, GridFSFile } from 'mongodb';
import { Readable } from 'stream';

export interface UploadedFile {
  id: string;
  filename: string;
  originalName: string;
  contentType: string;
  size: number;
  uploadDate: Date;
  url: string;
}

export interface FileMetadata {
  originalName?: string;
  contentType?: string;
  userId?: string;
  entityType?: string;
  entityId?: string;
}

@Injectable()
export class UploadsService {
  private bucket: GridFSBucket;

  constructor(@InjectConnection() private connection: Connection) {
    // Initialize GridFS bucket when connection is ready
    this.connection.once('open', () => {
      this.initBucket();
    });

    // If already connected
    if (this.connection.readyState === 1) {
      this.initBucket();
    }
  }

  private initBucket() {
    this.bucket = new GridFSBucket(this.connection.db as any, {
      bucketName: 'images',
    });
  }

  private ensureBucket() {
    if (!this.bucket) {
      if (this.connection.readyState !== 1) {
        throw new BadRequestException('Database connection not ready');
      }
      this.initBucket();
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    userId: string,
    entityType?: string,
    entityId?: string,
  ): Promise<UploadedFile> {
    this.ensureBucket();

    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Tipo de archivo no permitido. Tipos permitidos: ${allowedMimeTypes.join(', ')}`,
      );
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException('El archivo excede el tamaño máximo de 10MB');
    }

    const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}-${file.originalname}`;

    return new Promise((resolve, reject) => {
      const readableStream = new Readable();
      readableStream.push(file.buffer);
      readableStream.push(null);

      const uploadStream = this.bucket.openUploadStream(filename, {
        metadata: {
          originalName: file.originalname,
          contentType: file.mimetype,
          userId,
          entityType,
          entityId,
        } as FileMetadata,
      });

      readableStream
        .pipe(uploadStream)
        .on('error', (error) => reject(error))
        .on('finish', () => {
          resolve({
            id: uploadStream.id.toString(),
            filename,
            originalName: file.originalname,
            contentType: file.mimetype,
            size: file.size,
            uploadDate: new Date(),
            url: `/uploads/${uploadStream.id.toString()}`,
          });
        });
    });
  }

  async uploadMultiple(
    files: Express.Multer.File[],
    userId: string,
    entityType?: string,
    entityId?: string,
  ): Promise<UploadedFile[]> {
    const uploadPromises = files.map((file) =>
      this.uploadFile(file, userId, entityType, entityId),
    );
    return Promise.all(uploadPromises);
  }

  async getFile(fileId: string): Promise<{ stream: any; info: GridFSFile }> {
    this.ensureBucket();

    let objectId: ObjectId;
    try {
      objectId = new ObjectId(fileId);
    } catch {
      throw new BadRequestException('ID de archivo inválido');
    }

    const files = await this.bucket.find({ _id: objectId }).toArray();

    if (!files || files.length === 0) {
      throw new NotFoundException('Archivo no encontrado');
    }

    const fileInfo = files[0];
    const downloadStream = this.bucket.openDownloadStream(objectId);

    return {
      stream: downloadStream,
      info: fileInfo,
    };
  }

  async deleteFile(fileId: string): Promise<void> {
    this.ensureBucket();

    let objectId: ObjectId;
    try {
      objectId = new ObjectId(fileId);
    } catch {
      throw new BadRequestException('ID de archivo inválido');
    }

    const files = await this.bucket.find({ _id: objectId }).toArray();

    if (!files || files.length === 0) {
      throw new NotFoundException('Archivo no encontrado');
    }

    await this.bucket.delete(objectId);
  }

  async deleteMultiple(fileIds: string[]): Promise<void> {
    const deletePromises = fileIds.map((id) => this.deleteFile(id));
    await Promise.all(deletePromises);
  }

  async getFilesByEntity(entityType: string, entityId: string): Promise<GridFSFile[]> {
    this.ensureBucket();

    const files = await this.bucket
      .find({
        'metadata.entityType': entityType,
        'metadata.entityId': entityId,
      })
      .toArray();

    return files;
  }

  async updateEntityFiles(
    entityType: string,
    entityId: string,
    newFileIds: string[],
  ): Promise<void> {
    this.ensureBucket();

    // Get existing files
    const existingFiles = await this.getFilesByEntity(entityType, entityId);
    const existingIds = existingFiles.map((f) => f._id.toString());

    // Delete files that are no longer needed
    const toDelete = existingIds.filter((id) => !newFileIds.includes(id));
    if (toDelete.length > 0) {
      await this.deleteMultiple(toDelete);
    }

    // Update metadata for new files
    for (const fileId of newFileIds) {
      if (!existingIds.includes(fileId)) {
        try {
          const objectId = new ObjectId(fileId);
          await this.connection.db?.collection('images.files').updateOne(
            { _id: objectId },
            {
              $set: {
                'metadata.entityType': entityType,
                'metadata.entityId': entityId,
              },
            },
          );
        } catch {
          // File might not exist, skip
        }
      }
    }
  }
}
