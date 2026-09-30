import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { Response } from "express";
import {
  CurrentUser,
  JwtPayload,
} from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { UuidPipe } from "../common/pipes/uuid.pipe";
import { DetectedType, EXTENSIONS, detectFileType } from "./file-signature";
import { UploadService } from "./upload.service";

const IMAGE_TYPES: DetectedType[] = ["image/jpeg", "image/png", "image/webp"];
const DOCUMENT_TYPES: DetectedType[] = ["application/pdf", ...IMAGE_TYPES];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10 MB
// Nom d'un document tel que généré à l'upload : uuid + extension connue.
const DOCUMENT_FILE_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|png|jpg|webp)$/;
const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

/**
 * Vérifie le type réel du fichier (ses premiers octets) : le type annoncé
 * par le navigateur n'est qu'une déclaration de l'utilisateur.
 */
function checkedType(
  file: Express.Multer.File | undefined,
  allowed: DetectedType[],
  label: string,
): DetectedType {
  if (!file) throw new BadRequestException("Fichier manquant");
  const type = detectFileType(file.buffer);
  if (!type || !allowed.includes(type)) {
    throw new BadRequestException(`Format non supporté — ${label} uniquement`);
  }
  return type;
}

@ApiTags("upload")
@ApiBearerAuth()
@Controller("upload")
export class UploadController {
  private readonly posterBucket: string;
  private readonly avatarBucket: string;

  constructor(
    private readonly uploadService: UploadService,
    private readonly config: ConfigService,
  ) {
    this.posterBucket = this.config.get("MINIO_BUCKET_POSTERS", "posters");
    this.avatarBucket = this.config.get("MINIO_BUCKET_AVATARS", "avatars");
  }

  @Post("poster")
  @HttpCode(HttpStatus.CREATED)
  @Roles("ORGANIZER", "ADMIN")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: MAX_IMAGE_SIZE } }),
  )
  @ApiOperation({ summary: "Uploader une affiche événement (ORGANIZER)" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: { file: { type: "string", format: "binary" } },
    },
  })
  async uploadPoster(@UploadedFile() file: Express.Multer.File) {
    const type = checkedType(file, IMAGE_TYPES, "JPEG, PNG ou WebP");
    const url = await this.uploadService.upload(
      file.buffer,
      EXTENSIONS[type],
      this.posterBucket,
      type,
      "public",
    );
    return { url };
  }

  /**
   * Faille corrigée : les pièces justificatives (identité KYC, justificatif
   * « but non lucratif ») étaient déposées dans un bucket en lecture
   * publique, sans contrôle de format. Elles sont désormais privées, rangées
   * par propriétaire, et lues uniquement via GET upload/documents/…
   */
  @Post("document")
  @HttpCode(HttpStatus.CREATED)
  @Roles("ORGANIZER")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: MAX_DOCUMENT_SIZE } }),
  )
  @ApiOperation({
    summary: "Uploader un document (statut non-lucratif, KYC) — ORGANIZER",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: { file: { type: "string", format: "binary" } },
    },
  })
  async uploadDocument(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const type = checkedType(file, DOCUMENT_TYPES, "PDF, JPEG, PNG ou WebP");
    const url = await this.uploadService.upload(
      file.buffer,
      EXTENSIONS[type],
      this.uploadService.documentsBucket,
      type,
      "private",
      user.sub,
    );
    return { url };
  }

  /** Consultation d'un document privé : son propriétaire ou un admin. */
  @Get("documents/:ownerId/:file")
  @ApiOperation({ summary: "Consulter un document justificatif (propriétaire ou admin)" })
  async getDocument(
    @CurrentUser() user: JwtPayload,
    @Param("ownerId", UuidPipe) ownerId: string,
    @Param("file") fileName: string,
    @Res() res: Response,
  ) {
    if (!DOCUMENT_FILE_NAME.test(fileName)) {
      throw new BadRequestException("Nom de document invalide.");
    }
    if (user.sub !== ownerId && !ADMIN_ROLES.includes(user.role)) {
      throw new ForbiddenException("Vous n'avez pas accès à ce document.");
    }
    const { body } = await this.uploadService.readObject(
      this.uploadService.documentsBucket,
      `${ownerId}/${fileName}`,
    );
    // Type déduit du contenu, jamais de la métadonnée stockée.
    const type = detectFileType(body) ?? "application/octet-stream";
    res.set({
      "Content-Type": type,
      "Content-Disposition": `inline; filename="${fileName}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    });
    res.send(body);
  }

  @Post("avatar")
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: MAX_IMAGE_SIZE } }),
  )
  @ApiOperation({ summary: "Uploader un avatar utilisateur" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: { file: { type: "string", format: "binary" } },
    },
  })
  async uploadAvatar(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const type = checkedType(file, IMAGE_TYPES, "JPEG, PNG ou WebP");
    const url = await this.uploadService.upload(
      file.buffer,
      EXTENSIONS[type],
      this.avatarBucket,
      type,
      "public",
    );
    return { url, user_id: user.sub };
  }
}
