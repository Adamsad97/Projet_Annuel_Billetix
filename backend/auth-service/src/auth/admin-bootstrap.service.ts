import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import { Repository } from "typeorm";
import { User, UserRole } from "../user/user.entity";

const BCRYPT_ROUNDS = 12;

/** Crée le premier SUPER_ADMIN depuis BOOTSTRAP_ADMIN_* si aucun n'existe ; jamais de recréation ni d'écrasement. */
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

    // Compte bootstrap déjà présent en simple ADMIN : promu plutôt que recréé (email unique).
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
        last_name: "BilleTix",
        role: UserRole.SUPER_ADMIN,
        is_email_verified: true,
      }),
    );

    this.logger.warn(
      `Compte super-admin de démarrage créé (${email}) — pensez à retirer BOOTSTRAP_ADMIN_PASSWORD des variables d'environnement après la première connexion.`,
    );
  }
}
