import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  HeadBucketCommand,
  DeleteBucketPolicyCommand,
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

    // Seules les factures sont stockées : le billet n'existe que dans
    // l'application (QR éphémère), il n'y a plus de billet PDF.
    this.bucket = this.config.get<string>('MINIO_BUCKET_INVOICES', 'invoices');

    this.client = new S3Client({
      endpoint: `${useSSL ? 'https' : 'http'}://${endpoint}:${port}`,
      region: 'us-east-1',
      credentials: {
        accessKeyId: this.config.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
        secretAccessKey: this.config.get<string>('MINIO_SECRET_KEY', 'minioadmin'),
      },
      forcePathStyle: true,
    });

    // Rend le bucket des factures privé dès le démarrage ; en cas d'échec, retenté au premier upload.
    this.ensureBucket(this.bucket).catch((error) =>
      this.logger.warn(`Bucket ${this.bucket} non vérifié au démarrage : ${error?.message}`),
    );
  }

  // Buckets déjà vérifiés privés par ce processus (évite un appel MinIO à
  // chaque PDF généré).
  private readonly privateBuckets = new Set<string>();

  /** Sécurité : billets et factures dans des buckets privés, servis uniquement par la gateway au titulaire authentifié. */
  async ensureBucket(bucket: string = this.bucket): Promise<void> {
    if (this.privateBuckets.has(bucket)) return;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: bucket }));
      this.logger.log(`Bucket créé (privé) : ${bucket}`);
    }
    try {
      await this.client.send(new DeleteBucketPolicyCommand({ Bucket: bucket }));
    } catch {
      // Aucune politique à retirer : le bucket est déjà privé.
    }
    this.privateBuckets.add(bucket);
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

    // Adresse stockée comme simple localisateur (bucket + clé), résolue par la gateway.
    const publicEndpoint = this.config.get<string>('MINIO_PUBLIC_ENDPOINT', 'localhost');
    const port = this.config.get<string>('MINIO_PORT', '9000');
    const useSSL = this.config.get<string>('MINIO_USE_SSL', 'false') === 'true';
    return `${useSSL ? 'https' : 'http'}://${publicEndpoint}:${port}/${bucket}/${key}`;
  }
}
