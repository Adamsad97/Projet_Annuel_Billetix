AUDIT BILLETIX — État réel vs CDC

---

CE QUI EST FAIT ✅

Infrastructure

- 16 conteneurs Docker Up (postgres, redis, rabbitmq, minio, mailhog + 10 services + frontend)
- 7 schemas PostgreSQL créés (auth, users, events, orders, tickets, payments, admin_logs)
- docker-compose.yml + docker-compose.dev.yml complets
- .env.example documenté
- Dockerfiles multi-stage pour tous les services
- .dockerignore optimisés sur tous les services

auth-service

- register, login, refresh token, logout
- forgot-password, reset-password, verify-email
- bcrypt cost 12
- JWT access 15min / refresh 30j
- Redis blacklist (révocation immédiate)
- Table auth.users auto-créée

api-gateway

- Auth guard JWT global
- RolesGuard (ADMIN, ORGANIZER, AGENT)
- ThrottlerModule (rate limiting)
- CORS, Helmet
- Swagger
- IoAdapter WebSocket (Socket.IO)
- Routes auth câblées
- Routes users câblées (acheteur + organisateur)
- Routes events câblées (public + organisateur + admin)
- Routes orders câblées
- Routes tickets câblées (scan, offline-sync, agents, session, revente)
- Routes payments câblées (intent, webhook, reversements, litiges)
- Routes admin câblées (users, events, tickets, payouts, disputes, audit log)
- WebSocket Gateway /tickets avec rooms buyer:{userId} (push scan temps réel)
- Orchestration post-paiement dans le webhook Stripe (génération billets → PDF → notifications)

user-service

- BuyerProfile entity + service + controller (profil acheteur, adresse facturation)
- OrganizerProfile entity + service + controller (profil organisateur, logo, description)
- IBAN chiffré AES-256 (CryptoService)

event-service

- Event entity avec workflow DRAFT → PENDING_VALIDATION → PUBLISHED → CANCELLED
- CRUD complet événements
- Catalogue public filtrable
- TicketCategory entity + service + controller
- PromoCode entity + service + controller
- ValidationRequest entity + service (submit, approve, reject, suspend, cancel)
- Actions admin sur les événements

order-service

- Order entity + OrderItem entity
- Création commande, historique acheteur, détail, annulation
- Commandes par événement (ORGANIZER/ADMIN)

ticket-service

- Ticket entity entièrement dénormalisé (acheteur + événement + artiste + catégorie + QR)
- Génération QR code HMAC-SHA256
- Scan QR avec résultats (SUCCESS, ALREADY_USED, INVALID, CANCELLED)
- ScanLog entity
- Mode hors ligne (OfflineSyncLog entity + service)
- ControlAgent entity + service (assignation agents, sessions mobile)
- Revente J-24h (TicketResale entity + service) — annulation bloquée à -24h, marché secondaire, remboursement acheteur original
- Transfert billet avec nouveau QR code (invalide l'ancien)
- Invalidation admin
- ticket.set_pdf_url pour mise à jour URL après génération PDF

payment-service

- Payment entity + service + controller
- Stripe PaymentIntent
- Webhook Stripe avec vérification signature + anti-doublon (already_processed)
- Payout entity + service + controller (reversements J+7, anticipés, blocage)
- Dispute entity + service + controller (litiges, résolution)
- Remboursement Stripe

notification-service

- 8 EventPatterns RabbitMQ avec ACK manuel (welcome, email_verification, password_reset, order_confirmed, payment_confirmed, ticket_ready, event_canceled, event_reminder, ticket_scanned)
- MailService Handlebars
- 8 templates .hbs complets (dont QR codes, tableau billets, motif annulation)
- Copie des templates dans dist via nest-cli.json assets

pdf-service

- MinioService (client S3-compatible, création bucket auto)
- TicketPdfService — génération HTML → PDF A5 via Puppeteer (design complet)
- Upload PDF sur MinIO, retour URL publique
- TicketPdfController — écoute pdf.generate_ticket (RabbitMQ, ACK/NACK manuel)
- Callback TCP vers ticket.set_pdf_url après génération

admin-service

- AuditLog entity (enums AuditAction, AuditEntityType, schema admin_logs)
- AuditLogService — log(), getLogs() avec filtres/pagination, getStats()
- AuditLogController — patterns TCP (log_action, get_logs, get_stats)
- Audit log automatique sur chaque action admin (fire-and-forget)

---

CE QUI MANQUE ❌

auth-service

- 2FA TOTP (enable + verify) — obligatoire si IBAN associé (point S1)
- OAuth Google

user-service

- KYC complet : soumission pièces d'identité, stockage MinIO, statuts (PENDING / APPROVED / REJECTED)
- Gestion des agents (create, revoke) par l'organisateur
- Upload avatar MinIO

event-service

- Upload affiche événement sur MinIO
- Émissions RabbitMQ manquantes : event.published, event.rejected, event.suspended vers notification-service
- Gestion des modifications / reports post-publication (F3)
- Événements récurrents / multi-représentations (F7)

order-service

- Lock Redis anti-race condition (F1) — réservation temporaire 10min avec token, SETNX + expiration
- Réservation de stock temporaire avant paiement (sans ça deux acheteurs peuvent acheter le même dernier billet)
- Application des codes promo (l'entité existe dans event-service mais pas la logique côté order)
- Liste d'attente / waitlist (F6)

payment-service

- PayPal (webhook + intent)
- Frais 0,50€/billet gratuit facturés à l'organisateur en fin de mois (F2)
- Solde virtuel organisateur (balance en temps réel)
- Déclenchement automatique reversements J+7 (cron)

notification-service

- Retry 3× espacées de 10min en cas d'échec SMTP
- Cron rappel J-1 (email + push acheteur avant l'événement)
- Notifications seuils de remplissage organisateur (25% / 50% / 75% / 100%)
- Email reversement effectué (payout.completed)

admin-service

- Dashboard KPIs globaux (ventes, revenus, événements en attente)
- Liste et recherche utilisateurs
- KYC admin : approve / reject avec notification organisateur
- Reversements en attente (liste + déclencher manuellement)
- payment.get_all_disputes non implémenté côté payment-service

ticket-service

- Stats temps réel par événement (entrées validées, restants, taux de remplissage)
- Affichage agents : prénom + initiale seulement (point S5 — ne pas exposer nom complet)

api-gateway

- Préfixe /api/v1/ non appliqué dans main.ts (T4)

frontend (tout manque)

- Page inscription / connexion / reset password
- Catalogue événements (liste + filtres + recherche)
- Page détail événement + achat billets
- Tunnel d'achat (panier, adresse, paiement Stripe.js)
- Mes billets (liste, QR code affiché, téléchargement PDF)
- Profil acheteur (statut billet mis à jour en temps réel via WebSocket après scan)
- Tableau de bord organisateur (mes événements, ventes, reversements)
- Application de scan (agents — scan QR caméra + résultat visuel)
- Back-office admin (modération, KPIs, litiges)
- Bandeau cookies / consentement RGPD (R4)

Hors périmètre actuel

- App mobile React Native de scan (Phase 3)
- Plan de salle numéroté (F8)
- Tests de charge
- Backup / disaster recovery
