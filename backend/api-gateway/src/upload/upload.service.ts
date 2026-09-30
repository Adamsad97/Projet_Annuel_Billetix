import { Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  CreateBucketCommand,
  DeleteBucketPolicyCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

/** Visibilité d'un bucket : public (affiches, avatars) ou privé (pièces justificatives). */
export type BucketVisibility = "public" | "private";

@Injectable()
export class UploadService implements OnModuleInit {
  private readonly logger = new Logger(UploadService.name);
  private client: S3Client;
  private publicBase: string;
  private readonly documentBucket: string;

  constructor(private readonly config: ConfigService) {
    this.documentBucket = this.config.get("MINIO_BUCKET_DOCUMENTS", "documents");
  }

  async onModuleInit() {
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

    // Faille corrigée : le bucket des pièces justificatives (identité KYC,
    // justificatif « but non lucratif ») recevait une règle de lecture
    // publique. Il est remis en privé à chaque démarrage, y compris s'il a
    // été créé avec l'ancienne règle.
    await this.ensureBucket(this.documentBucket, "private").catch((err) =>
      this.logger.warn(`Bucket ${this.documentBucket} non vérifié au démarrage : ${err?.message}`),
    );
  }

  get documentsBucket(): string {
    return this.documentBucket;
  }

  /**
   * Lit un fichier privé (billet, facture) à partir de l'adresse stockée en
   * base — adresse jamais servie telle quelle au navigateur : l'appelant
   * vérifie d'abord que l'utilisateur en est le titulaire.
   */
  async readStoredFile(storedUrl: string): Promise<Buffer> {
    const path = new URL(storedUrl).pathname.replace(/^\/+/, "");
    const [bucket, ...keyParts] = path.split("/");
    return (await this.readObject(bucket, decodeURIComponent(keyParts.join("/")))).body;
  }

  /** Lit un objet ; 404 s'il n'existe pas. */
  async readObject(bucket: string, key: string): Promise<{ body: Buffer; contentType: string }> {
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!result.Body) throw new NotFoundException("Document introuvable.");
      return {
        body: Buffer.from(await result.Body.transformToByteArray()),
        contentType: result.ContentType ?? "application/octet-stream",
      };
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      if ((err as { name?: string })?.name === "NoSuchKey") throw new NotFoundException("Document introuvable.");
      throw err;
    }
  }

  /**
   * Dépose un fichier. Le nom est généré (jamais celui fourni par
   * l'utilisateur) ; `prefix` range les documents privés par propriétaire.
   */
  async upload(
    buffer: Buffer,
    extension: string,
    bucket: string,
    mimeType: string,
    visibility: BucketVisibility,
    prefix?: string,
  ): Promise<string> {
    await this.ensureBucket(bucket, visibility);
    const key = `${prefix ? `${prefix}/` : ""}${randomUUID()}${extension}`;

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

  // Bucket public (affiches, avatars) : lecture anonyme pour que le
  // navigateur les affiche directement. Bucket privé : aucune règle publique,
  // lecture uniquement via la passerelle après contrôle d'accès.
  private async ensureBucket(bucket: string, visibility: BucketVisibility): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: bucket }));
    }

    if (visibility === "private") {
      await this.client.send(new DeleteBucketPolicyCommand({ Bucket: bucket })).catch(() => undefined);
      return;
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
