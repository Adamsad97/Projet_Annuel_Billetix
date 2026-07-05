import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  CreateBucketCommand,
  HeadBucketCommand,
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

    this.publicBase = `${ssl ? "https" : "http"}://${endpoint}:${port}`;

    this.client = new S3Client({
      endpoint: this.publicBase,
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

  private async ensureBucket(bucket: string): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: bucket }));
    }
  }
}
