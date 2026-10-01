import { Inject, Injectable, Logger } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { firstValueFrom } from "rxjs";

export interface AdminRecipient {
  email: string;
  first_name: string;
}

/** Comptes à prévenir d'une action à traiter : admins et super admins actifs, une fois par adresse. */
@Injectable()
export class AdminRecipients {
  private readonly logger = new Logger(AdminRecipients.name);

  constructor(
    @Inject("AUTH_SERVICE") private readonly authClient: ClientProxy,
    @Inject("NOTIFICATION_SERVICE") private readonly notifClient: ClientProxy,
  ) {}

  async list(): Promise<AdminRecipient[]> {
    const pages = await Promise.all(
      (["ADMIN", "SUPER_ADMIN"] as const).map((role) =>
        firstValueFrom(
          this.authClient.send<{ data: AdminRecipient[] }>("auth.list_users", { role, status: "active", limit: 100 }),
        ),
      ),
    );
    const byEmail = new Map(pages.flatMap((page) => page.data).map((admin) => [admin.email.toLowerCase(), admin]));
    return [...byEmail.values()];
  }

  /** Alerte générique à chaque admin, sans bloquer l'appelant ; ctaPath est la page admin à ouvrir. */
  noticeInBackground(notice: {
    subject: string;
    headline: string;
    intro: string;
    details?: string[];
    ctaLabel: string;
    ctaPath: string;
  }): void {
    this.list()
      .then((admins) => {
        for (const admin of admins) {
          this.notifClient.emit("notification.admin_notice", { email: admin.email, firstName: admin.first_name, ...notice });
        }
      })
      .catch((err) => this.logger.error(`Alerte admin « ${notice.subject} » non envoyée : ${(err as Error)?.message}`));
  }
}
