import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(private readonly config: ConfigService) {
    const hex = this.config.get<string>('ENCRYPTION_KEY');
    if (!hex || hex.length !== 64) {
      throw new Error('ENCRYPTION_KEY doit être une chaîne hex de 64 caractères (32 bytes)');
    }
    this.key = Buffer.from(hex, 'hex');
  }

  encrypt(plaintext: string): { encrypted: string; iv: string; tag: string } {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return {
      encrypted: encrypted.toString('hex'),
      iv: iv.toString('hex'),
      tag: cipher.getAuthTag().toString('hex'),
    };
  }

  decrypt(encrypted: string, iv: string, tag: string): string {
    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  }
}
