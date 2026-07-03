# AUDIT & SUIVI — BilletiX

> Document vivant — mis à jour au fur et à mesure de l'avancement du projet.
> Dernière mise à jour : 2026-07-03

---

## État actuel du projet

**Stade : Étape 1 en cours — auth-service implémenté, api-gateway à câbler**

| Livrable CDC | État | Détail |
|---|---|---|
| Infrastructure Docker | ✅ Terminé | 16 conteneurs Up, health checks OK, volumes persistants |
| Base de données | ✅ Terminé | 7 schemas PostgreSQL créés, extensions uuid-ossp + pg_trgm |
| Shared | ✅ Terminé | `backend/shared/` — constants, events RabbitMQ, interfaces TypeScript |
| auth-service | ✅ Implémenté | register · login · refresh · logout · validate_token · forgot/reset password · verify email — bcrypt cost 12, JWT 15m/30d, Redis blacklist, table `auth.users` auto-créée |
| api-gateway | 🟡 Scaffolding | NestJS HTTP, Swagger, ThrottlerModule, 7 clients TCP — routes à câbler |
| user-service | 🟡 Scaffolding | `backend/user-service/` — NestJS TCP |
| event-service | 🟡 Scaffolding | `backend/event-service/` — NestJS TCP + RabbitMQ |
| order-service | 🟡 Scaffolding | `backend/order-service/` — NestJS TCP + Redis + RabbitMQ |
| ticket-service | 🟡 Scaffolding | `backend/ticket-service/` — NestJS TCP + Redis + RabbitMQ + qrcode |
| payment-service | 🟡 Scaffolding | `backend/payment-service/` — NestJS TCP + Stripe |
| notification-service | 🟡 Scaffolding | `backend/notification-service/` — NestJS RMQ consumer |
| pdf-service | 🟡 Scaffolding | `backend/pdf-service/` — NestJS RMQ consumer + Puppeteer |
| admin-service | 🟡 Scaffolding | `backend/admin-service/` — NestJS TCP + TypeORM |
| Frontend Web (Next.js) | 🟡 Scaffolding | `frontend/` — Next.js 16, standalone mode activé, Dockerfile |
| App mobile de scan | ❌ Absent | Phase 3 — aucun code React Native |

---

## Décision d'architecture : Microservices

**Date de décision : 2026-07-03**

L'application est construite en architecture microservices pour permettre :
- Une conteneurisation Docker indépendante par service
- Un déploiement et une mise à l'échelle granulaires
- Une séparation claire des responsabilités entre domaines métier
- Un développement parallèle par l'équipe sans couplage fort

### Diagramme des services

```
                        ┌─────────────────────────────────────────────────┐
                        │                  CLIENTS                        │
                        │   Browser (Next.js)   App Mobile (React Native) │
                        └───────────────────┬─────────────────────────────┘
                                            │ HTTPS
                                            ▼
                        ┌───────────────────────────────┐
                        │         API GATEWAY           │  :3000
                        │   Routing · Auth Guard        │
                        │   Rate Limiting · CORS        │
                        │   Swagger agrégé              │
                        └──┬──┬──┬──┬──┬──┬──┬──┬──┬──┘
                           │  │  │  │  │  │  │  │  │
              TCP/HTTP (synchrone — NestJS microservices transport)
         ┌─────┘  │  │  │  │  │  │  │  └──────┐
         ▼        ▼  ▼  ▼  ▼  ▼  ▼  ▼         ▼
    ┌─────────┐ ┌──────┐ ┌───────┐ ┌───────┐ ┌─────────┐
    │  auth   │ │ user │ │ event │ │ order │ │  admin  │
    │ service │ │ svc  │ │  svc  │ │  svc  │ │  svc    │
    │  :3001  │ │:3002 │ │ :3003 │ │ :3004 │ │  :3009  │
    └─────────┘ └──────┘ └───────┘ └───────┘ └─────────┘
                              │          │
                    ┌─────────┘          └─────────┐
                    ▼                              ▼
              ┌──────────┐                  ┌─────────────┐
              │  ticket  │                  │   payment   │
              │ service  │                  │   service   │
              │  :3005   │                  │    :3006    │
              └──────────┘                  └─────────────┘

                    │              EVENTS ASYNCHRONES              │
                    └──────────────────┬───────────────────────────┘
                                       ▼
                          ┌────────────────────────┐
                          │       RABBITMQ         │  :5672
                          │   Message Broker       │  :15672 (UI)
                          └────────┬───────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
             ┌────────────┐               ┌────────────┐
             │notification│               │    pdf     │
             │  service   │               │  service   │
             │   :3007    │               │   :3008    │
             └────────────┘               └────────────┘

                         INFRASTRUCTURE PARTAGÉE
         ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐
         │ PostgreSQL │  │   Redis    │  │   MinIO    │  │  MailHog   │
         │   :5432    │  │   :6379    │  │ :9000/9001 │  │:1025/8025  │
         │ (schemas   │  │ (cache,    │  │ (S3 local) │  │ (SMTP dev) │
         │ séparés)   │  │  sessions, │  │            │  │            │
         │            │  │  queues)   │  │            │  │            │
         └────────────┘  └────────────┘  └────────────┘  └────────────┘
```

---

## Décomposition des microservices

### 1. `api-gateway` — Port 3000

**Rôle :** Point d'entrée unique pour tous les clients (browser, mobile).

| Responsabilité | Détail |
|---|---|
| Routing | Redirige chaque requête vers le service concerné via TCP |
| Auth Guard global | Valide le JWT sur toutes les routes protégées |
| Rate limiting | Par IP et par compte (protection brute force) |
| CORS | Configuration centralisée |
| Swagger | Documentation OpenAPI agrégée de tous les services |
| Helmet | Headers de sécurité HTTP |

**Dépendances npm :**
```
@nestjs/common @nestjs/core @nestjs/microservices @nestjs/jwt
@nestjs/throttler @nestjs/swagger helmet class-validator class-transformer
@nestjs/config
```

---

### 2. `auth-service` — Port 3001

**Rôle :** Tout ce qui concerne l'identité et les sessions.

| Endpoint | Description |
|---|---|
| `POST /auth/register` | Inscription + envoi email de vérification |
| `POST /auth/login` | Connexion → access token + refresh token |
| `POST /auth/refresh` | Renouvellement du access token |
| `POST /auth/logout` | Révocation du refresh token (blacklist Redis) |
| `POST /auth/forgot-password` | Envoi lien reset |
| `POST /auth/reset-password` | Changement de mot de passe |
| `POST /auth/verify-email` | Validation du lien d'activation |
| `POST /auth/2fa/enable` | Activation 2FA TOTP |
| `POST /auth/2fa/verify` | Vérification code TOTP |
| `GET /auth/google` | OAuth Google |

**Base de données (schema `auth`) :**
```
users           (id, email, password_hash, roles, email_verified, created_at)
refresh_tokens  (id, user_id, token_hash, expires_at, revoked)
password_resets (id, user_id, token_hash, expires_at, used)
```

**Dépendances npm :**
```
@nestjs/passport @nestjs/jwt passport passport-jwt passport-local
passport-google-oauth20 bcrypt @nestjs/typeorm typeorm pg
ioredis @nestjs/config class-validator class-transformer
```

**Points de sécurité obligatoires :**
- bcrypt coût ≥ 12 sur tous les hash de mots de passe
- Access token : expiration 15 minutes
- Refresh token : expiration 30 jours, stocké hashé en DB
- Révocation immédiate en cas de logout ou changement de mot de passe
- 2FA obligatoire dès qu'un IBAN est associé au compte (point S1 de l'audit)

---

### 3. `user-service` — Port 3002

**Rôle :** Profils utilisateurs, KYC, gestion des agents.

| Endpoint | Description |
|---|---|
| `GET /users/me` | Profil courant |
| `PATCH /users/me` | Mise à jour du profil |
| `POST /users/organizer/profile` | Complétion profil organisateur (IBAN, logo) |
| `GET /users/organizer/:id` | Profil public organisateur |
| `POST /users/kyc/submit` | Soumission pièces d'identité KYC |
| `GET /users/kyc/status` | Statut KYC |
| `POST /users/agents` | Créer un compte agent (par organisateur) |
| `DELETE /users/agents/:id` | Révoquer un accès agent |

**Base de données (schema `users`) :**
```
buyer_profiles      (id, user_id, phone, billing_address)
organizer_profiles  (id, user_id, name, description, logo_url, iban_encrypted, kyc_status)
agent_profiles      (id, user_id, organizer_id, assigned_events[])
kyc_documents       (id, organizer_id, doc_type, file_url, status, reviewed_at)
```

**Note RGPD critique :** L'IBAN doit être chiffré en AES-256 au niveau applicatif avant stockage (point S2 de l'audit). Ne jamais stocker en clair.

---

### 4. `event-service` — Port 3003

**Rôle :** Cycle de vie complet des événements et du catalogue.

| Endpoint | Description |
|---|---|
| `POST /events` | Création (statut : Brouillon) |
| `PATCH /events/:id` | Modification |
| `POST /events/:id/submit` | Soumission à validation (→ En attente) |
| `GET /events` | Catalogue public (recherche, filtres) |
| `GET /events/:id` | Page détail |
| `GET /events/organizer/mine` | Événements de l'organisateur connecté |
| `POST /events/:id/ticket-categories` | Créer une catégorie de billet |
| `PATCH /events/:id/ticket-categories/:catId` | Modifier une catégorie |
| `POST /events/:id/publish` | Admin : valider et publier |
| `POST /events/:id/reject` | Admin : rejeter avec motifs |
| `POST /events/:id/suspend` | Admin : suspendre |

**Workflow de statut :**
```
DRAFT → PENDING_VALIDATION → PUBLISHED → FINISHED → ARCHIVED
                          ↘ REJECTED (→ DRAFT pour correction)
              PUBLISHED → SUSPENDED (admin)
```

**Base de données (schema `events`) :**
```
events             (id, organizer_id, title, description, category, start_date, end_date,
                    venue_name, venue_address, venue_lat, venue_lng, poster_url,
                    total_capacity, status, nonprofit, refund_policy, created_at)
ticket_categories  (id, event_id, name, price_ht, quota, quota_remaining,
                    description, visibility, max_per_order, valid_dates[])
event_validations  (id, event_id, admin_id, action, notes, created_at)
```

**Émission d'événements RabbitMQ :**
- `event.published` → notification-service (notifie l'organisateur)
- `event.rejected` → notification-service (notifie l'organisateur avec motifs)
- `event.suspended` → notification-service

---

### 5. `order-service` — Port 3004

**Rôle :** Tunnel d'achat, gestion du stock en temps réel, statuts des commandes.

| Endpoint | Description |
|---|---|
| `POST /orders/reserve` | Réservation temporaire du stock (Redis, 10 min) |
| `POST /orders` | Création commande (après paiement confirmé) |
| `GET /orders/mine` | Historique acheteur |
| `GET /orders/:id` | Détail commande |
| `POST /orders/:id/cancel` | Annulation |
| `POST /orders/:id/resend-tickets` | Renvoi des billets |

**Mécanisme anti-race-condition (critique, point F1) :**
```
1. POST /orders/reserve
   → SETNX lock:category:{catId}:{sessionId} EX 600  (Redis)
   → Décrémente quota_reserved en mémoire Redis
   → Retourne reservation_token valable 10 min
2. POST /orders (avec reservation_token)
   → Vérifie que le token est toujours valide
   → Crée la commande en DB
   → Confirme la décrémentation du quota en PostgreSQL (transaction)
3. Si abandon panier ou expiration → RELEASE du lock Redis
```

**Base de données (schema `orders`) :**
```
orders       (id, buyer_id, event_id, status, total_ht, total_ttc,
              payment_method, stripe_payment_intent_id, created_at)
order_items  (id, order_id, ticket_category_id, quantity, unit_price_ht)
```

**Statuts de commande :**
```
PENDING_PAYMENT → CONFIRMED → TICKETS_SENT → CANCELLED → REFUNDED
```

**Émission d'événements RabbitMQ :**
- `order.confirmed` → ticket-service (génère les billets), notification-service
- `order.cancelled` → payment-service (déclenche remboursement), notification-service

---

### 6. `ticket-service` — Port 3005

**Rôle :** Génération, validation et contrôle d'accès des billets.

| Endpoint | Description |
|---|---|
| `GET /tickets/mine` | Billets de l'acheteur connecté |
| `GET /tickets/:id` | Détail d'un billet |
| `POST /tickets/scan` | Validation QR code (agents) |
| `POST /tickets/scan/manual` | Saisie manuelle numéro billet |
| `GET /tickets/event/:id/sync` | Sync hors ligne — liste billets valides |
| `GET /tickets/event/:id/stats` | Compteurs temps réel (entrées, restants) |
| `POST /tickets/:id/invalidate` | Admin : invalidation manuelle |

**Génération du QR code :**
```typescript
// Token = HMAC-SHA256 signé
const payload = `${ticketId}:${eventId}:${createdAt}`;
const signature = createHmac('sha256', HMAC_SECRET_KEY).update(payload).digest('hex');
const token = Buffer.from(`${payload}:${signature}`).toString('base64url');
// → Encodé dans le QR code
```

**Validation :**
```
1. Décode le token base64url
2. Recalcule le HMAC et compare (timing-safe comparison)
3. Vérifie que ticket.status = 'VALID' (en base ou cache Redis)
4. Atomic UPDATE status → 'USED' (PostgreSQL FOR UPDATE)
5. Retourne : VALID (vert) | ALREADY_USED (rouge) | WRONG_EVENT (orange) | INVALID (rouge)
```

**Mode hors ligne (résolution contradiction T1/I2) :**
- Maximum 4h avant l'événement : l'agent télécharge la liste chiffrée des tokens valides (AES-256)
- Validation locale : recalcul HMAC sans API
- File d'attente des scans locaux resynchronisée dès reconnexion
- Les invalidations post-sync sont marquées comme "à vérifier" avec alerte visuelle

**Base de données (schema `tickets`) :**
```
tickets      (id, order_id, event_id, ticket_category_id, buyer_name,
              qr_token_hash, status, scanned_at, scanned_by_agent_id)
scan_logs    (id, ticket_id, agent_id, scanned_at, result, offline_mode)
```

---

### 7. `payment-service` — Port 3006

**Rôle :** Intégration des prestataires de paiement et reversements.

| Endpoint | Description |
|---|---|
| `POST /payments/intent` | Créer un PaymentIntent Stripe |
| `POST /payments/webhook/stripe` | Webhook Stripe (confirmation, échec) |
| `POST /payments/webhook/paypal` | Webhook PayPal |
| `GET /payments/organizer/balance` | Solde virtuel organisateur |
| `GET /payments/organizer/payouts` | Historique reversements |
| `POST /payments/payouts/trigger` | Admin : déclencher un reversement |
| `POST /payments/refund/:orderId` | Remboursement acheteur |

**Calcul des commissions :**
```
Prix HT × 10%   → événement commercial standard
Prix HT × 8%    → événement commercial jauge > 1 000 places
0,00€            → événement à but non lucratif validé
0,50€ / billet  → billet à 0€ (facturé à l'organisateur en fin de mois)
```

**Base de données (schema `payments`) :**
```
payments           (id, order_id, amount, currency, provider, provider_payment_id,
                    status, created_at)
organizer_balances (id, organizer_id, gross_amount, commission, net_amount,
                    payout_status, event_id)
payouts            (id, organizer_id, amount, iban_last4, payout_date, stripe_payout_id)
refunds            (id, payment_id, amount, reason, status, created_at)
```

**Émission d'événements RabbitMQ :**
- `payment.confirmed` → order-service (confirme la commande)
- `payment.refunded` → notification-service
- `payout.completed` → notification-service

---

### 8. `notification-service` — Port 3007

**Rôle :** Envoi de tous les emails et notifications push. Service purement réactif (consomme RabbitMQ, n'expose pas d'API publique sauf renvoi manuel).

**Événements consommés depuis RabbitMQ :**

| Événement | Action |
|---|---|
| `order.confirmed` | Email confirmation + billets PDF |
| `ticket.generated` | Email avec PDF en pièce jointe |
| `event.published` | Email organisateur : événement validé |
| `event.rejected` | Email organisateur : motifs de rejet |
| `event.suspended` | Email organisateur : suspension |
| `payment.refunded` | Email acheteur : confirmation remboursement |
| `payout.completed` | Email organisateur : reversement effectué |
| `event.reminder_j1` | Email + push acheteur : rappel J-1 (cron) |
| `event.threshold_25/50/75/100` | Email organisateur : seuils de remplissage |

**Retry en cas d'échec :** 3 tentatives espacées de 10 min, puis alerte admin.

**Prestataires :** SendGrid (production) / MailHog (développement local).

**Dépendances npm :**
```
@nestjs-modules/mailer nodemailer @nestjs/microservices amqplib amqp-connection-manager
@nestjs/config @nestjs/schedule
```

---

### 9. `pdf-service` — Port 3008

**Rôle :** Génération asynchrone des billets PDF.

**Événement consommé :** `ticket.created` (depuis RabbitMQ)

**Processus :**
```
1. Reçoit l'événement avec les données du billet
2. Génère le PDF (Puppeteer ou WeasyPrint)
3. Upload le PDF sur MinIO/S3
4. Émet ticket.pdf.ready avec l'URL du PDF
5. notification-service envoie l'email avec le PDF en pièce jointe
```

**Contrainte CDC :** génération < 10 secondes par billet.

---

### 10. `admin-service` — Port 3009

**Rôle :** Back-office pour l'équipe interne. Accès restreint au rôle ADMIN.

| Endpoint | Description |
|---|---|
| `GET /admin/dashboard` | KPIs globaux |
| `GET /admin/events/pending` | File de validation |
| `POST /admin/events/:id/validate` | Valider un événement |
| `POST /admin/events/:id/reject` | Rejeter un événement |
| `GET /admin/users` | Liste et recherche utilisateurs |
| `POST /admin/users/:id/suspend` | Suspendre un compte |
| `POST /admin/kyc/:id/approve` | Valider un KYC |
| `POST /admin/kyc/:id/reject` | Rejeter un KYC |
| `GET /admin/payouts/pending` | Soldes en attente de reversement |
| `POST /admin/payouts/:id/release` | Déclencher un reversement |
| `POST /admin/payouts/:id/block` | Bloquer un reversement |
| `GET /admin/disputes` | Gestion des litiges |
| `GET /admin/audit-log` | Journal horodaté de toutes les actions |

---

## Structure du monorepo

```
BILLETIX/
├── docker-compose.yml          ← orchestration complète
├── docker-compose.dev.yml      ← surcharges dev (hot reload, ports exposés)
├── .env.example                ← toutes les variables documentées
├── .gitignore
│
├── frontend/                   ← Next.js 16 (acheteurs + organisateurs)
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── Dockerfile
│   └── package.json
│
└── backend/
    ├── api-gateway/            ← NestJS HTTP (port 3000) — 🟡 routes à câbler
    │   ├── src/
    │   ├── Dockerfile
    │   └── package.json
    ├── auth-service/           ← NestJS TCP (port 3001) — ✅ Implémenté
    ├── user-service/           ← NestJS TCP (port 3002) — 🟡 Scaffolding
    ├── event-service/          ← NestJS TCP (port 3003) — 🟡 Scaffolding
    ├── order-service/          ← NestJS TCP (port 3004) — 🟡 Scaffolding
    ├── ticket-service/         ← NestJS TCP (port 3005) — 🟡 Scaffolding
    ├── payment-service/        ← NestJS TCP (port 3006) — 🟡 Scaffolding
    ├── notification-service/   ← NestJS RMQ consumer (port 3007) — 🟡 Scaffolding
    ├── pdf-service/            ← NestJS + Puppeteer RMQ (port 3008) — 🟡 Scaffolding
    ├── admin-service/          ← NestJS TCP (port 3009) — 🟡 Scaffolding
    ├── shared/                 ← constantes, events RabbitMQ, interfaces TypeScript
    └── infra/postgres/         ← init.sql : 7 schemas créés au démarrage
```

---

## Infrastructure Docker

### Services Docker Compose

| Conteneur | Image | Port(s) | Rôle |
|---|---|---|---|
| `postgres` | postgres:16-alpine | 5432 | Base de données unique, schemas séparés par service |
| `redis` | redis:7-alpine | 6379 | Cache, sessions JWT, queues BullMQ, locks stock |
| `rabbitmq` | rabbitmq:3-management | 5672 / 15672 | Message broker inter-services |
| `minio` | minio/minio | 9000 / 9001 | Stockage S3 local (PDF billets, images événements) |
| `mailhog` | mailhog/mailhog | 1025 / 8025 | SMTP de développement (pas d'email réels) |
| `api-gateway` | build local | 3000 | Point d'entrée |
| `auth-service` | build local | 3001 | Auth |
| `user-service` | build local | 3002 | Profils |
| `event-service` | build local | 3003 | Événements |
| `order-service` | build local | 3004 | Commandes |
| `ticket-service` | build local | 3005 | Billets + scan |
| `payment-service` | build local | 3006 | Paiements |
| `notification-service` | build local | 3007 | Emails / Push |
| `pdf-service` | build local | 3008 | Génération PDF |
| `admin-service` | build local | 3009 | Back-office |
| `frontend` | build local | 80 | Next.js SSR |

### Stratégie base de données

**Un seul serveur PostgreSQL, un schema par service :**
```sql
CREATE SCHEMA auth;       -- auth-service
CREATE SCHEMA users;      -- user-service
CREATE SCHEMA events;     -- event-service
CREATE SCHEMA orders;     -- order-service
CREATE SCHEMA tickets;    -- ticket-service
CREATE SCHEMA payments;   -- payment-service
CREATE SCHEMA admin_logs; -- admin-service
```

Chaque service a son propre utilisateur PostgreSQL avec accès limité à son schema uniquement.

### Communication inter-services

| Type | Technologie | Usage |
|---|---|---|
| Synchrone | TCP (NestJS microservices) | api-gateway → services |
| Asynchrone | RabbitMQ (AMQP) | events métier entre services |
| Cache/Lock | Redis | Sessions, stock, blacklist JWT |

---

## Flux d'événements RabbitMQ

```
[order-service]  ──order.confirmed──►  [ticket-service]  ──ticket.created──►  [pdf-service]
                                                │                                    │
                                      ──ticket.pdf.ready──►  [notification-service] ◄┘
                                                                       │
                                                              Email billet à l'acheteur

[payment-service] ──payment.confirmed──► [order-service] → confirme commande
[payment-service] ──payment.refunded───► [notification-service] → email remboursement
[event-service]   ──event.published────► [notification-service] → email organisateur
[event-service]   ──event.rejected─────► [notification-service] → email organisateur
[admin-service]   ──payout.completed───► [notification-service] → email organisateur
```

---

## Évaluation globale du CDC (v1.0 — Mai 2026)

| Dimension | Note | Verdict |
|---|---|---|
| Complétude fonctionnelle | 7/10 | Bonne base, lacunes identifiées |
| Architecture technique | 7/10 | Stack solide, angles morts critiques |
| Sécurité | 6/10 | Bases présentes, failles non traitées |
| Conformité RGPD | 5/10 | Déclaratif, non opérationnel |
| Modèle économique | 6/10 | Incohérences à corriger |
| Planning | 5/10 | Sous-estimé, phases incomplètes |

---

## Points d'audit CDC

| # | Catégorie | Problème | Priorité | Statut | Service concerné |
|---|---|---|---|---|---|
| F1 | Fonctionnel | Race condition stock → résolu par lock Redis dans order-service | P1 | ✅ Résolu (design) | order-service |
| F2 | Fonctionnel | Frais 0,50€/billet gratuit sans transaction | P1 | ⏳ | payment-service |
| F3 | Fonctionnel | Gestion des modifications/reports post-publication | P1 | ⏳ | event-service |
| F4 | Fonctionnel | KYC : processus complet non spécifié | P1 | ⏳ | user-service |
| F5 | Fonctionnel | Transfert/revente officielle de billets absents | P2 | ⏳ | ticket-service |
| F6 | Fonctionnel | Liste d'attente (waitlist) absente | P2 | ⏳ | order-service |
| F7 | Fonctionnel | Événements récurrents / multi-représentations | P2 | ⏳ | event-service |
| F8 | Fonctionnel | Plan de salle numéroté absent | P3 | ❌ Hors périmètre | — |
| T1 | Technique | Mode hors ligne vs temps réel → résolu par policy 4h + delta-sync | P1 | ✅ Résolu (design) | ticket-service |
| T2 | Technique | Refresh token + révocation → implémenté dans auth-service (jti + Redis blacklist) | P1 | ✅ Implémenté | auth-service |
| T3 | Technique | Clés HMAC QR → env var secrets, rotation à planifier | P1 | 🔄 Partiel | ticket-service |
| T4 | Technique | Versioning API → `/api/v1/` via api-gateway | P2 | ⏳ | api-gateway |
| T5 | Technique | Backup / disaster recovery non définis | P2 | ⏳ | infra |
| T6 | Technique | Queue PDF asynchrone → résolu via RabbitMQ + pdf-service | P2 | ✅ Résolu (design) | pdf-service |
| T7 | Technique | 1 000 tx simultanées → lock Redis + scaling horizontal | P2 | ⏳ | order-service |
| T8 | Technique | CORS → centralisé dans api-gateway | P3 | ✅ Résolu (design) | api-gateway |
| S1 | Sécurité | 2FA obligatoire si IBAN → enforced dans auth-service | P1 | ⏳ | auth-service |
| S2 | Sécurité | IBAN chiffré AES-256 → défini dans user-service | P1 | ⏳ | user-service |
| S3 | Sécurité | Politique mots de passe → MinLength 8 + bcrypt cost 12 implémentés | P2 | ✅ Implémenté | auth-service |
| S4 | Sécurité | Brute force → @nestjs/throttler dans api-gateway | P2 | ⏳ | api-gateway |
| S5 | Sécurité | Agents voient nom complet → afficher prénom + initiale | P2 | ⏳ | ticket-service |
| R1 | RGPD | Durées de conservation non définies | P1 | ⏳ | tous |
| R2 | RGPD | DPA organisateurs absent | P1 | ⏳ | legal |
| R3 | RGPD | Sous-traitants hors UE (Stripe, SendGrid, AWS) | P1 | ⏳ | legal |
| R4 | RGPD | Cookies et bandeau de consentement | P2 | ⏳ | frontend |
| B1 | Business | Litige > 30 jours sans résolution | P2 | ⏳ | admin-service |
| B2 | Business | Codes promo non spécifiés | P3 | ⏳ | order-service |
| B3 | Business | Accessibilité WCAG 2.1 AA | P3 | ⏳ | frontend |
| P1 | Planning | Phase design UI/UX absente | P1 | ⏳ | — |
| P2 | Planning | Phase tests de charge absente | P2 | ⏳ | — |
| P3 | Planning | Phase 1 sous-estimée | P2 | ⏳ | — |

**Légende :** ⏳ En attente · 🔄 En cours · ✅ Résolu · ❌ Hors périmètre

---

## Incohérences internes du CDC

| # | Sections | Description | Résolution |
|---|---|---|---|
| I1 | 4.3 vs 5.1 | Frais 0,50€/billet gratuit sans transaction | À clarifier : facturer l'organisateur en fin de mois |
| I2 | 5.3 vs 6.3 | "Vérification temps réel" contredit "mode hors ligne" | Résolu : fenêtre hors ligne max 4h, delta-sync invalidations |
| I3 | 3.1 vs 3.3 | Date d'ouverture ventes configurable mais ventes post-validation | À gérer dans event-service : si date passée → ouverture immédiate |
| I4 | 7.2 | Litige bloqué 30 jours max — aucune règle après | À définir : arbitrage admin obligatoire J+30 |
| I5 | 2.3 | "Expiration JWT configurable" | Résolu : 15 min access / 30 jours refresh, non configurable par user |
| I6 | 4.3 | Nonprofit à 0€ → "frais Stripe standard" sans transaction | Résolu : si 0€ → pas de Stripe → 0 frais |

---

## Prochaines étapes

### Étape 0 — Fondations ✅ TERMINÉ (0 jour restant)

- [x] Restructurer le repo : `backend/` microservices (suppression de l'ancien monolithe)
- [x] Créer `.env.example` avec toutes les variables (DB, Redis, RabbitMQ, Stripe, HMAC, JWT...)
- [x] Créer `docker-compose.yml` (postgres, redis, rabbitmq, minio, mailhog + 10 services + frontend)
- [x] Créer `docker-compose.dev.yml` (surcharges hot-reload, volumes)
- [x] Scaffolding de chaque service NestJS (10 services + api-gateway)
- [x] Créer `backend/shared/` avec constants, events RabbitMQ, interfaces TypeScript
- [x] Configurer un Dockerfile multi-stage par service (base / dev / builder / prod)
- [x] Lancer l'appli complète — 16 conteneurs Up, infra healthy

### Étape 1 — Auth & User 🔄 EN COURS

- [x] `auth-service` : register, login, JWT access+refresh, logout, validate_token, forgot/reset password, verify email, bcrypt cost 12, Redis blacklist
- [ ] `api-gateway` : routes HTTP /auth/*, auth guard JWT, Swagger, rate limiting ← **PROCHAIN**
- [ ] `user-service` : profils acheteur et organisateur, IBAN chiffré AES-256

### Étape 2 — Événements

- [ ] `event-service` : CRUD, workflow DRAFT→PUBLISHED, catalogue public filtrable
- [ ] Intégration MinIO pour upload affiches événements
- [ ] Tableau de bord organisateur (frontend)
- [ ] Back-office validation admin (frontend + admin-service)

### Étape 3 — Achat & Billets

- [ ] `order-service` : tunnel d'achat, lock Redis anti-race-condition, statuts
- [ ] `payment-service` : Stripe Connect, webhooks, reversements
- [ ] `ticket-service` : génération QR HMAC-SHA256, validation scan, mode hors ligne
- [ ] `pdf-service` : génération PDF Puppeteer, upload MinIO
- [ ] `notification-service` : email billet, confirmations, rappels

---

## Planning ajusté

| Phase | Périmètre | Durée estimée | Jours restants | Statut |
|---|---|---|---|---|
| Étape 0 — Fondations | Repo, Docker, scaffolding 10 services, infra | 1 semaine | **0 j** | ✅ Terminé |
| Étape 1 — Auth & User | auth-service, api-gateway, user-service | 2-3 semaines | ~10 j | 🔄 En cours |
| Étape 2 — Événements | event-service, catalogue, admin validation | 3 semaines | ~21 j | ⏳ |
| Étape 3 — Achat & Billets | order, payment, ticket, pdf, notification | 6-7 semaines | ~45 j | ⏳ |
| Design UI/UX + Frontend | Maquettes, pages Next.js | 2-3 semaines | ~21 j | ⏳ |
| Phase 2 — Financier | Commissions, reversements, KYC complet | 2-3 mois | ~70 j | ⏳ |
| Phase 3 — Scan complet | Hors ligne, supervision, multi-agents | 4-6 semaines | ~35 j | ⏳ |
| Phase 4 — Optimisation | SEO, promos, analytics | 1-2 mois | ~45 j | ⏳ |
| Tests de charge | Validation performance avant prod | 2-3 semaines | ~18 j | ⏳ |
| **Total restant** | | | **~265 j** | |

> Le passage en microservices ajoute ~1-2 mois de setup initial par rapport à un monolithe, mais facilite grandement le déploiement, le scaling et la séparation du travail entre développeurs.

---

## Journal des modifications

| Date | Version | Description |
|---|---|---|
| 2026-07-03 | 1.0 | Audit initial du CDC BilletiX v1.0 |
| 2026-07-03 | 1.1 | Audit du code existant — projet au stade scaffolding, 0 % de code métier |
| 2026-07-03 | 1.2 | Décision architecture microservices — décomposition complète en 9 services + API Gateway |
| 2026-07-03 | 1.3 | Étape 0 terminée — scaffolding complet : 10 services NestJS, Dockerfiles multi-stage, docker-compose, .env.example, shared/, infra/postgres/init.sql |
| 2026-07-03 | 1.4 | Lancement complet — 16 conteneurs Up (infra healthy, services en mode dev hot-reload) |
| 2026-07-03 | 1.5 | auth-service implémenté — register, login, refresh, logout, validate_token, forgot/reset password, verify email · bcrypt cost 12 · JWT 15m/30d · Redis blacklist jti · table auth.users auto-créée · Étape 0 : 0 j restant |
