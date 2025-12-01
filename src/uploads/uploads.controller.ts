import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { UploadsService } from './uploads.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  /**
   * Subir un archivo
   * POST /uploads
   */
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('id') userId: string,
  ) {
    const uploaded = await this.uploadsService.uploadFile(file, userId);
    return {
      message: 'Archivo subido exitosamente',
      file: uploaded,
    };
  }

  /**
   * Subir múltiples archivos
   * POST /uploads/multiple
   */
  @Post('multiple')
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadMultiple(
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser('id') userId: string,
  ) {
    const uploaded = await this.uploadsService.uploadMultiple(files, userId);
    return {
      message: `${uploaded.length} archivos subidos exitosamente`,
      files: uploaded,
    };
  }

  /**
   * Obtener archivo (público para mostrar imágenes)
   * GET /uploads/:id
   */
  @Public()
  @Get(':id')
  async getFile(@Param('id') fileId: string, @Res() res: Response) {
    const { stream, info } = await this.uploadsService.getFile(fileId);

    const metadata = info.metadata as { contentType?: string; originalName?: string } | undefined;

    res.set({
      'Content-Type': metadata?.contentType || 'application/octet-stream',
      'Content-Length': info.length,
      'Content-Disposition': `inline; filename="${metadata?.originalName || info.filename}"`,
      'Cache-Control': 'public, max-age=31536000',
    });

    stream.pipe(res);
  }

  /**
   * Descargar archivo
   * GET /uploads/:id/download
   */
  @Public()
  @Get(':id/download')
  async downloadFile(@Param('id') fileId: string, @Res() res: Response) {
    const { stream, info } = await this.uploadsService.getFile(fileId);

    const metadata = info.metadata as { contentType?: string; originalName?: string } | undefined;

    res.set({
      'Content-Type': metadata?.contentType || 'application/octet-stream',
      'Content-Length': info.length,
      'Content-Disposition': `attachment; filename="${metadata?.originalName || info.filename}"`,
    });

    stream.pipe(res);
  }

  /**
   * Eliminar archivo
   * DELETE /uploads/:id
   */
  @Delete(':id')
  async deleteFile(@Param('id') fileId: string) {
    await this.uploadsService.deleteFile(fileId);
    return {
      message: 'Archivo eliminado exitosamente',
    };
  }
}
