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

    // Rend privés billets et factures dès le démarrage, y compris des
    // buckets créés publics avant le correctif — sans attendre le prochain
    // PDF généré. Échec non bloquant (MinIO pas encore prêt) : retenté au
    // premier upload.
    const invoicesBucket = this.config.get<string>('MINIO_BUCKET_INVOICES', 'invoices');
    for (const bucket of [this.bucket, invoicesBucket]) {
      this.ensureBucket(bucket).catch((error) =>
        this.logger.warn(`Bucket ${bucket} non vérifié au démarrage : ${error?.message}`),
      );
    }
  }

  // Buckets déjà vérifiés privés par ce processus (évite un appel MinIO à
  // chaque PDF généré).
  private readonly privateBuckets = new Set<string>();

  /**
   * Bug corrigé (faille de sécurité) : billets et factures étaient en
   * lecture publique, à une adresse prévisible (ticket-TKT-2026-XXXXXX.pdf,
   * ~16 millions de combinaisons) — un script pouvait télécharger des
   * billets et des factures (données
   * personnelles) sans aucune connexion. Buckets désormais privés : le PDF
   * n'est servi que par l'api-gateway, au titulaire authentifié. La
   * politique publique des buckets créés avant ce correctif est retirée.
   */
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

    // Adresse stockée en base comme simple localisateur (bucket + clé) :
    // le bucket étant privé, elle n'est plus lisible directement — l'api-
    // gateway la résout pour servir le fichier au titulaire authentifié.
    const publicEndpoint = this.config.get<string>('MINIO_PUBLIC_ENDPOINT', 'localhost');
    const port = this.config.get<string>('MINIO_PORT', '9000');
    const useSSL = this.config.get<string>('MINIO_USE_SSL', 'false') === 'true';
    return `${useSSL ? 'https' : 'http'}://${publicEndpoint}:${port}/${bucket}/${key}`;
  }
}
