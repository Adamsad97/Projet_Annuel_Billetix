import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { extname } from "path";

@Injectable()
export class UploadService implements OnModuleInit {
  private client: S3Client;
  private publicBase: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const endpoint = this.config.get("MINIO_ENDPOINT", "minio");
    const port = this.config.get("MINIO_PORT", "9000");
    const ssl = this.config.get("MINIO_USE_SSL", "false") === "true";
    const internalBase = `${ssl ? "https" : "http"}://${endpoint}:${port}`;

    // Bug corrigé : les URLs de posters/avatars/documents renvoyées au
    // navigateur pointaient vers le nom d'hôte interne au réseau Docker
    // (minio), injoignable depuis l'extérieur — d'où des images cassées.
    // MINIO_PUBLIC_ENDPOINT est l'hôte réellement joignable (localhost en
    // dev), distinct de l'endpoint interne utilisé par le client S3 lui-même.
    const publicEndpoint = this.config.get("MINIO_PUBLIC_ENDPOINT", "localhost");
    this.publicBase = `${ssl ? "https" : "http"}://${publicEndpoint}:${port}`;

    this.client = new S3Client({
      endpoint: internalBase,
      region: "us-east-1",
      credentials: {
        accessKeyId: this.config.get("MINIO_ACCESS_KEY", "minioadmin"),
        secretAccessKey: this.config.get("MINIO_SECRET_KEY", "minioadmin"),
      },
      forcePathStyle: true,
    });
  }

  async upload(
    buffer: Buffer,
    originalName: string,
    bucket: string,
    mimeType: string,
  ): Promise<string> {
    await this.ensureBucket(bucket);

    const ext = extname(originalName) || ".bin";
    const key = `${randomUUID()}${ext}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );

    return `${this.publicBase}/${bucket}/${key}`;
  }

  // Bug corrigé : le bucket créé restait privé par défaut (politique MinIO
  // de base) — toute affiche/avatar/justificatif uploadé renvoyait 403 dès
  // que le navigateur tentait de l'afficher directement via son URL
  // publique (repéré via une affiche cassée sur la fiche de validation
  // admin). La policy est réappliquée à chaque appel (idempotent, coût
  // négligeable) pour couvrir aussi les buckets déjà créés avant ce correctif.
  private async ensureBucket(bucket: string): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: bucket }));
    }

    await this.client.send(
      new PutBucketPolicyCommand({
        Bucket: bucket,
        Policy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: "*",
              Action: ["s3:GetObject"],
              Resource: [`arn:aws:s3:::${bucket}/*`],
            },
          ],
        }),
      }),
    );
  }
}
