import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { Redis } from 'ioredis';
import { Repository } from 'typeorm';
import { REDIS_CLIENT } from '../redis/redis.module';
import { OAuthProvider, User, UserRole } from '../user/user.entity';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

const BCRYPT_ROUNDS = 12;
const RESET_TOKEN_TTL = 60 * 60;       // 1 heure
const EMAIL_VERIFY_TTL = 24 * 60 * 60; // 24 heures

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new RpcException({ statusCode: 409, message: 'Email déjà utilisé' });
    }

    const password_hash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = this.userRepo.create({
      email: dto.email,
      password_hash,
      first_name: dto.first_name,
      last_name: dto.last_name,
      phone: dto.phone ?? null,
      role: dto.role ?? UserRole.BUYER,
    });

    await this.userRepo.save(user);

    const verifyToken = randomUUID();
    await this.redis.set(`email_verify:${verifyToken}`, user.id, 'EX', EMAIL_VERIFY_TTL);

    // TODO : publier auth.user_registered sur RabbitMQ → notification-service envoie l'email
    // Le verify_token ne doit jamais être retourné dans la réponse HTTP en production.
    // Il voyage uniquement par email (lien de type /auth/verify-email?token=xxx).

    return {
      ...this.generateTokens(user),
      user: this.sanitize(user),
    };
  }

  async login(dto: LoginDto) {
    const user = await this.userRepo
      .createQueryBuilder('u')
      .addSelect('u.password_hash')
      .where('u.email = :email', { email: dto.email })
      .getOne();

    if (!user) {
      throw new RpcException({ statusCode: 401, message: 'Identifiants invalides' });
    }
    if (!user.is_active) {
      throw new RpcException({ statusCode: 403, message: 'Compte désactivé' });
    }
    if (user.is_suspended) {
      throw new RpcException({ statusCode: 403, message: 'Compte suspendu' });
    }
    if (!user.password_hash) {
      throw new RpcException({ statusCode: 401, message: 'Connexion via OAuth requise' });
    }

    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) {
      throw new RpcException({ statusCode: 401, message: 'Identifiants invalides' });
    }

    return { ...this.generateTokens(user), user: this.sanitize(user) };
  }

  async refresh(dto: RefreshTokenDto) {
    let payload: { sub: string; jti: string; exp: number };
    try {
      payload = this.jwtService.verify(dto.refresh_token, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new RpcException({ statusCode: 401, message: 'Refresh token invalide ou expiré' });
    }

    const blacklisted = await this.redis.get(`blacklist:${payload.jti}`);
    if (blacklisted) {
      throw new RpcException({ statusCode: 401, message: 'Refresh token révoqué' });
    }

    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user || !user.is_active || user.is_suspended) {
      throw new RpcException({ statusCode: 401, message: 'Utilisateur introuvable ou suspendu' });
    }

    const access_token = this.signAccess(user);
    return { access_token };
  }

  async logout(dto: RefreshTokenDto) {
    try {
      const payload = this.jwtService.decode(dto.refresh_token) as { jti?: string; exp?: number };
      if (payload?.jti && payload?.exp) {
        const ttl = payload.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await this.redis.set(`blacklist:${payload.jti}`, '1', 'EX', ttl);
        }
      }
    } catch {
      // token malformé — déconnexion côté client suffit
    }
    return { success: true };
  }

  async oauthLogin(data: {
    provider: OAuthProvider;
    oauth_id: string;
    email: string;
    first_name: string;
    last_name: string;
  }) {
    let user = await this.userRepo.findOne({
      where: { oauth_provider: data.provider, oauth_id: data.oauth_id },
    });

    if (!user) {
      // Vérifier si l'email existe déjà (liaison de compte)
      user = await this.userRepo.findOne({ where: { email: data.email } });
      if (user) {
        user.oauth_provider = data.provider;
        user.oauth_id = data.oauth_id;
        await this.userRepo.save(user);
      } else {
        user = this.userRepo.create({
          email: data.email,
          first_name: data.first_name,
          last_name: data.last_name,
          oauth_provider: data.provider,
          oauth_id: data.oauth_id,
          is_email_verified: true,
          email_verified_at: new Date(),
          role: UserRole.BUYER,
        });
        await this.userRepo.save(user);
      }
    }

    if (!user.is_active || user.is_suspended) {
      throw new RpcException({ statusCode: 403, message: 'Compte suspendu ou désactivé' });
    }

    return { ...this.generateTokens(user), user: this.sanitize(user) };
  }

  async validateToken(token: string) {
    try {
      const payload = this.jwtService.verify<{ sub: string; email: string; role: UserRole }>(
        token,
        { secret: this.config.get<string>('JWT_ACCESS_SECRET') },
      );
      return { sub: payload.sub, email: payload.email, role: payload.role };
    } catch {
      throw new RpcException({ statusCode: 401, message: 'Token invalide ou expiré' });
    }
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });
    // Ne pas révéler si l'email existe ou non
    if (!user) return { success: true };

    const token = randomUUID();
    await this.redis.set(`reset_password:${token}`, user.id, 'EX', RESET_TOKEN_TTL);

    // TODO : émettre un événement RabbitMQ pour que notification-service envoie l'email
    // Pour l'instant on retourne le token pour tests en dev
    return { success: true, debug_token: this.config.get('NODE_ENV') !== 'production' ? token : undefined };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const userId = await this.redis.get(`reset_password:${dto.token}`);
    if (!userId) {
      throw new RpcException({ statusCode: 400, message: 'Token invalide ou expiré' });
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new RpcException({ statusCode: 404, message: 'Utilisateur introuvable' });
    }

    user.password_hash = await bcrypt.hash(dto.new_password, BCRYPT_ROUNDS);
    await this.userRepo.save(user);
    await this.redis.del(`reset_password:${dto.token}`);

    return { success: true };
  }

  async verifyEmail(token: string) {
    const userId = await this.redis.get(`email_verify:${token}`);
    if (!userId) {
      throw new RpcException({ statusCode: 400, message: 'Token de vérification invalide ou expiré' });
    }

    await this.userRepo.update(userId, { is_email_verified: true });
    await this.redis.del(`email_verify:${token}`);

    return { success: true };
  }

  // --- Helpers ---

  private generateTokens(user: User): { access_token: string; refresh_token: string } {
    const jti = randomUUID();

    const access_token = this.signAccess(user);

    const refresh_token = this.jwtService.sign(
      { sub: user.id, jti },
      {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '30d',
      },
    );

    return { access_token, refresh_token };
  }

  private signAccess(user: User): string {
    return this.jwtService.sign(
      { sub: user.id, email: user.email, role: user.role },
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m',
      },
    );
  }

  private sanitize(user: User) {
    const { password_hash, ...safe } = user as User & { password_hash?: string };
    return safe;
  }
}
