import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UploadService } from './upload.service';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

@ApiTags('upload')
@ApiBearerAuth()
@Controller('upload')
export class UploadController {
  private readonly posterBucket: string;
  private readonly documentBucket: string;

  constructor(
    private readonly uploadService: UploadService,
    private readonly config: ConfigService,
  ) {
    this.posterBucket = this.config.get('MINIO_BUCKET_POSTERS', 'posters');
    this.documentBucket = this.config.get('MINIO_BUCKET_DOCUMENTS', 'documents');
  }

  @Post('poster')
  @HttpCode(HttpStatus.CREATED)
  @Roles('ORGANIZER', 'ADMIN')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_SIZE } }))
  @ApiOperation({ summary: 'Uploader une affiche événement (ORGANIZER)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  async uploadPoster(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Fichier manquant');
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Format non supporté — JPEG, PNG ou WebP uniquement');
    }
    const url = await this.uploadService.upload(file.buffer, file.originalname, this.posterBucket, file.mimetype);
    return { url };
  }

  @Post('document')
  @HttpCode(HttpStatus.CREATED)
  @Roles('ORGANIZER')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Uploader un document (statut non-lucratif, KYC) — ORGANIZER' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  async uploadDocument(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Fichier manquant');
    const url = await this.uploadService.upload(file.buffer, file.originalname, this.documentBucket, file.mimetype);
    return { url };
  }

  @Post('avatar')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_SIZE } }))
  @ApiOperation({ summary: 'Uploader un avatar utilisateur' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  async uploadAvatar(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Fichier manquant');
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Format non supporté — JPEG, PNG ou WebP uniquement');
    }
    const avatarBucket = this.config.get('MINIO_BUCKET_AVATARS', 'avatars');
    const url = await this.uploadService.upload(file.buffer, file.originalname, avatarBucket, file.mimetype);
    return { url, user_id: user.sub };
  }
}
