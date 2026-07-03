import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

@Injectable()
export class MinioService implements OnModuleInit {
  private client: S3Client;
  private bucket: string;
  private readonly logger = new Logger(MinioService.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const endpoint = this.config.get<string>('MINIO_ENDPOINT', 'minio');
    const port = this.config.get<string>('MINIO_PORT', '9000');
    const useSSL = this.config.get<string>('MINIO_USE_SSL', 'false') === 'true';

    this.bucket = this.config.get<string>('MINIO_BUCKET_TICKETS', 'tickets');

    this.client = new S3Client({
      endpoint: `${useSSL ? 'https' : 'http'}://${endpoint}:${port}`,
      region: 'us-east-1',
      credentials: {
        accessKeyId: this.config.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
        secretAccessKey: this.config.get<string>('MINIO_SECRET_KEY', 'minioadmin'),
      },
      forcePathStyle: true,
    });
  }

  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Bucket créé : ${this.bucket}`);
    }
  }

  async uploadPdf(key: string, buffer: Buffer): Promise<string> {
    await this.ensureBucket();
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: 'application/pdf',
      }),
    );

    const endpoint = this.config.get<string>('MINIO_ENDPOINT', 'minio');
    const port = this.config.get<string>('MINIO_PORT', '9000');
    const useSSL = this.config.get<string>('MINIO_USE_SSL', 'false') === 'true';
    return `${useSSL ? 'https' : 'http'}://${endpoint}:${port}/${this.bucket}/${key}`;
  }
}
