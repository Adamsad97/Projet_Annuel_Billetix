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
 * Crée désormais un SUPER_ADMIN (et non un simple ADMIN) — le tout premier
 * compte d'un déploiement doit pouvoir gérer les autres admins (les
 * révoquer, les suspendre), ce qu'un ADMIN normal ne peut plus faire
 * depuis l'introduction du rôle SUPER_ADMIN (cf. AuthService.
 * assertCanManageTarget). Ne s'active que si BOOTSTRAP_ADMIN_EMAIL et
 * BOOTSTRAP_ADMIN_PASSWORD sont définis ET qu'aucun SUPER_ADMIN n'existe
 * encore — jamais de recréation/écrasement une fois un premier super-admin
 * en place, donc sans danger de laisser ces variables en place durablement.
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

    const existingSuperAdmin = await this.userRepo.findOne({
      where: { role: UserRole.SUPER_ADMIN },
    });
    if (existingSuperAdmin) return;

    // Déploiement déjà initialisé avant l'introduction de SUPER_ADMIN : le
    // compte bootstrap existe déjà en simple ADMIN — on le promeut plutôt
    // que de tenter d'en créer un second avec le même email (email unique).
    const existingByEmail = await this.userRepo.findOne({ where: { email } });
    if (existingByEmail) {
      if (existingByEmail.role !== UserRole.ADMIN) {
        this.logger.warn(
          `BOOTSTRAP_ADMIN_EMAIL (${email}) correspond à un compte existant de rôle ${existingByEmail.role} — promotion ignorée par sécurité, à traiter manuellement.`,
        );
        return;
      }
      existingByEmail.role = UserRole.SUPER_ADMIN;
      await this.userRepo.save(existingByEmail);
      this.logger.warn(`Compte admin de démarrage (${email}) promu SUPER_ADMIN.`);
      return;
    }

    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await this.userRepo.save(
      this.userRepo.create({
        email,
        password_hash,
        first_name: "Admin",
        last_name: "BilletiX",
        role: UserRole.SUPER_ADMIN,
        is_email_verified: true,
      }),
    );

    this.logger.warn(
      `Compte super-admin de démarrage créé (${email}) — pensez à retirer BOOTSTRAP_ADMIN_PASSWORD des variables d'environnement après la première connexion.`,
    );
  }
}
