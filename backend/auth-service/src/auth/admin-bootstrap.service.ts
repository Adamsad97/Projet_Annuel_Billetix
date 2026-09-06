import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import { Repository } from "typeorm";
import { User, UserRole } from "../user/user.entity";

const BCRYPT_ROUNDS = 12;

/**
 * Bug corrigé : aucun mécanisme de création du premier admin n'existait
 * dans le produit — le tout premier compte ADMIN d'un déploiement ne
 * pouvait être créé qu'en écrivant directement en base via SQL (constaté
 * lors des tests en conditions réelles du 2026-09-05). En production,
 * ça bloquerait totalement la mise en service de la plateforme.
 *
 * Ne s'active que si BOOTSTRAP_ADMIN_EMAIL et BOOTSTRAP_ADMIN_PASSWORD sont
 * définis ET qu'aucun compte ADMIN n'existe encore — jamais de recréation
 * ni d'écrasement une fois un premier admin en place, donc sans danger de
 * laisser ces variables en place durablement dans l'environnement.
 */
@Injectable()
export class AdminBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const email = this.config.get<string>("BOOTSTRAP_ADMIN_EMAIL");
    const password = this.config.get<string>("BOOTSTRAP_ADMIN_PASSWORD");
    if (!email || !password) return;

    const existingAdmin = await this.userRepo.findOne({
      where: { role: UserRole.ADMIN },
    });
    if (existingAdmin) return;

    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await this.userRepo.save(
      this.userRepo.create({
        email,
        password_hash,
        first_name: "Admin",
        last_name: "BilletiX",
        role: UserRole.ADMIN,
        is_email_verified: true,
      }),
    );

    this.logger.warn(
      `Compte admin de démarrage créé (${email}) — pensez à retirer BOOTSTRAP_ADMIN_PASSWORD des variables d'environnement après la première connexion.`,
    );
  }
}
