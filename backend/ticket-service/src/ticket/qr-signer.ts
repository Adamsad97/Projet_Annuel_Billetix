import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createPrivateKey, createPublicKey, KeyObject, sign, verify } from 'crypto';

/** Préfixe du QR code signé : `BTX3.<données>.<signature>`. */
export const SIGNED_QR_PREFIX = 'BTX3';
const FORMAT_VERSION = 1;
// version (1) + billet (16) + événement (16) + début (4) + durée (2) + empreinte (8)
const PAYLOAD_LENGTH = 47;

/** Ce qu'atteste un QR code signé. */
export interface QrClaims {
  ticketId: string;
  eventId: string;
  /** Début de la période de validité (secondes epoch). */
  validFrom: number;
  /** Durée de la période (secondes). */
  validSeconds: number;
  /** Empreinte du jeton du porteur (hex, 8 octets) : change à chaque revente ou transfert. */
  tokenFingerprint: string;
}

/** Empreinte publiable du jeton interne d'un billet (le jeton lui-même ne sort jamais). */
export function tokenFingerprint(token: string): string {
  return createHash('sha256').update(token).digest().subarray(0, 8).toString('hex');
}

function uuidToBytes(uuid: string): Buffer {
  return Buffer.from(uuid.replace(/-/g, ''), 'hex');
}

function bytesToUuid(bytes: Buffer): string {
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function encodeClaims(claims: QrClaims): Buffer {
  const payload = Buffer.alloc(PAYLOAD_LENGTH);
  payload.writeUInt8(FORMAT_VERSION, 0);
  uuidToBytes(claims.ticketId).copy(payload, 1);
  uuidToBytes(claims.eventId).copy(payload, 17);
  payload.writeUInt32BE(claims.validFrom, 33);
  payload.writeUInt16BE(claims.validSeconds, 37);
  Buffer.from(claims.tokenFingerprint, 'hex').copy(payload, 39);
  return payload;
}

function decodeClaims(payload: Buffer): QrClaims | null {
  if (payload.length !== PAYLOAD_LENGTH || payload.readUInt8(0) !== FORMAT_VERSION) return null;
  return {
    ticketId: bytesToUuid(payload.subarray(1, 17)),
    eventId: bytesToUuid(payload.subarray(17, 33)),
    validFrom: payload.readUInt32BE(33),
    validSeconds: payload.readUInt16BE(37),
    tokenFingerprint: payload.subarray(39, 47).toString('hex'),
  };
}

/** Signature Ed25519 des QR ; la clé publique permet aux appareils de contrôle de vérifier sans réseau. */
@Injectable()
export class QrSigner {
  private readonly privateKey: KeyObject;
  private readonly publicKey: KeyObject;

  constructor(config: ConfigService) {
    this.privateKey = createPrivateKey({
      key: Buffer.from(config.getOrThrow<string>('QR_SIGNING_PRIVATE_KEY'), 'base64'),
      format: 'der',
      type: 'pkcs8',
    });
    if (this.privateKey.asymmetricKeyType !== 'ed25519') {
      throw new Error('QR_SIGNING_PRIVATE_KEY doit être une clé Ed25519 (PKCS#8, DER, base64)');
    }
    this.publicKey = createPublicKey(this.privateKey);
  }

  /** Clé publique brute (32 octets, base64url) — celle qu'embarquent les appareils de contrôle. */
  get publicKeyBase64Url(): string {
    return this.publicKey.export({ format: 'jwk' }).x as string;
  }

  /** Texte du QR : déterministe (même période, même porteur → même code). */
  sign(claims: QrClaims): string {
    const payload = encodeClaims(claims);
    const signature = sign(null, payload, this.privateKey);
    return `${SIGNED_QR_PREFIX}.${payload.toString('base64url')}.${signature.toString('base64url')}`;
  }

  /** Attestation d'un QR signé authentique, null sinon (format, version ou signature invalide). */
  verify(raw: string): QrClaims | null {
    const match = /^BTX3\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(raw);
    if (!match) return null;
    const payload = Buffer.from(match[1], 'base64url');
    const signature = Buffer.from(match[2], 'base64url');
    if (signature.length !== 64) return null;
    if (!verify(null, payload, this.publicKey, signature)) return null;
    return decodeClaims(payload);
  }
}
