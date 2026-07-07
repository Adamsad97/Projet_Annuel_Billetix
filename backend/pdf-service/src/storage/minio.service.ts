import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
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

  async ensureBucket(bucket: string = this.bucket): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: bucket }));
      // Lecture publique — les billets/factures sont référencés par URL directe
      // (pas de mécanisme d'URL signée côté gateway), donc l'objet doit être
      // accessible sans credentials pour que le lien envoyé au client fonctionne.
      await this.client.send(
        new PutBucketPolicyCommand({
          Bucket: bucket,
          Policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: '*',
                Action: ['s3:GetObject'],
                Resource: [`arn:aws:s3:::${bucket}/*`],
              },
            ],
          }),
        }),
      );
      this.logger.log(`Bucket créé (lecture publique) : ${bucket}`);
    }
  }

  async uploadPdf(
    key: string,
    buffer: Buffer,
    bucket: string = this.bucket,
  ): Promise<string> {
    await this.ensureBucket(bucket);
    await this.client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: 'application/pdf',
      }),
    );

    const endpoint = this.config.get<string>('MINIO_ENDPOINT', 'minio');
    const port = this.config.get<string>('MINIO_PORT', '9000');
    const useSSL = this.config.get<string>('MINIO_USE_SSL', 'false') === 'true';
    return `${useSSL ? 'https' : 'http'}://${endpoint}:${port}/${bucket}/${key}`;
  }
}
