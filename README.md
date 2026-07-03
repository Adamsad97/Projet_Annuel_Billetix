# BilletiX — Plateforme de Billetterie Électronique

Plateforme de vente de billets en ligne avec QR codes à usage unique et contrôle d'accès.  
Architecture **microservices** · Conteneurisée avec **Docker** · API **RESTful** documentée Swagger.

---

## Démarrage rapide

```bash
cp .env.example .env   # 1. Copier et remplir les variables d'environnement
npm start              # 2. Construire et lancer toute l'application
```

> Premier lancement : 5 à 10 minutes (téléchargement des images Docker + installation des dépendances).  
> Relances suivantes : `npm run dev` (rapide, sans rebuild).

---

## Sommaire

- [Stack technique](#stack-technique)
- [Architecture](#architecture)
- [Structure du projet](#structure-du-projet)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Démarrage](#démarrage)
- [URLs et ports](#urls-et-ports)
- [Commandes utiles](#commandes-utiles)
- [Développement par service](#développement-par-service)
- [Tests](#tests)
- [Variables d'environnement](#variables-denvironnement)
- [Suivi du projet](#suivi-du-projet)

---

## Stack technique

| Couche | Technologie |
|---|---|
| Frontend web | Next.js 16, React 19, Tailwind CSS 4 |
| Application mobile | React Native (iOS & Android) — à venir |
| Backend | NestJS 11 — architecture microservices |
| Communication synchrone | TCP (NestJS microservices transport) |
| Communication asynchrone | RabbitMQ (AMQP) |
| Base de données | PostgreSQL 16 — un schema par service |
| Cache et verrous | Redis 7 |
| Stockage fichiers | MinIO (compatible AWS S3) |
| Génération PDF billets | Puppeteer |
| Paiement | Stripe Connect, PayPal, Orange Money, Wave |
| Emails transactionnels | SendGrid (production) / MailHog (développement) |
| Conteneurisation | Docker + Docker Compose |
| Documentation API | Swagger / OpenAPI 3 |

---

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │              CLIENTS                 │
                    │  Navigateur         App mobile       │
                    └───────┬─────────────────┬───────────┘
                            │                 │
                    HTTP :80│           HTTP :3000
                            ▼                 ▼
              ┌─────────────────┐   ┌──────────────────────┐
              │  frontend/      │   │     api-gateway       │
              │  Next.js  :80   │   │  HTTP/REST  :3000     │
              │  → interne 3000 │   │  Swagger, Auth Guard  │
              └─────────────────┘   └──┬───┬───┬───┬───┬───┘
                                       │   │   │   │   │
                                       │  TCP (réseau interne Docker)
                                 ┌─────┘ ┌─┘ ┌─┘ ┌─┘ ┌─┘
                                 ▼       ▼   ▼   ▼   ▼
                              auth    user event order ticket payment admin
                             :3001  :3002 :3003 :3004 :3005  :3006  :3009

                                       │ RabbitMQ (asynchrone)
                                       ▼
                        ┌──────────────────────────┐
                        │         RabbitMQ          │  :5672 / :15672
                        └──────┬────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
            notification-svc          pdf-svc
                :3007                  :3008

                      INFRASTRUCTURE PARTAGÉE
        PostgreSQL :5432 · Redis :6379 · MinIO :9000 · MailHog :1025
```

**Flux principal d'un achat :**
```
Acheteur → api-gateway → order-service → [order.confirmed] → ticket-service
                                                            → [ticket.created] → pdf-service → [ticket.pdf.ready]
                                                                                             → notification-service → Email billet
```

---

## Structure du projet

```
BILLETIX/
├── backend/
│   ├── api-gateway/           # Point d'entrée HTTP unique — port 3000
│   ├── auth-service/          # JWT, 2FA, OAuth Google — port 3001
│   ├── user-service/          # Profils acheteur / organisateur, KYC — port 3002
│   ├── event-service/         # Événements, validation admin, catalogue — port 3003
│   ├── order-service/         # Tunnel d'achat, réservation stock Redis — port 3004
│   ├── ticket-service/        # QR codes HMAC-SHA256, scan, hors-ligne — port 3005
│   ├── payment-service/       # Stripe Connect, reversements — port 3006
│   ├── notification-service/  # Emails et push (consommateur RabbitMQ) — port 3007
│   ├── pdf-service/           # Génération PDF billets (consommateur RabbitMQ) — port 3008
│   ├── admin-service/         # Back-office, modération, finances — port 3009
│   ├── shared/
│   │   ├── constants/         # Enums : rôles, statuts, catégories, délais
│   │   ├── events/            # Noms des messages RabbitMQ et patterns TCP
│   │   └── interfaces/        # Types TypeScript partagés entre services
│   └── infra/
│       └── postgres/
│           └── init.sql       # Création des schemas PostgreSQL au démarrage
├── frontend/                  # Next.js — acheteurs, organisateurs, back-office admin
├── docker-compose.yml         # Orchestration complète (production)
├── docker-compose.dev.yml     # Surcharges développement (hot reload, ports exposés)
├── .env.example               # Toutes les variables d'environnement documentées
├── .env                       # Variables locales (non commité)
├── README.md                  # Ce fichier
└── README-ETAPE.md            # Audit CDC et suivi d'avancement
```

---

## Prérequis

| Outil | Version minimale | Vérification |
|---|---|---|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | 4.x (Compose v2) | `docker compose version` |
| [Node.js](https://nodejs.org/) | 22 LTS | `node --version` |
| Git | — | `git --version` |

> Node.js est uniquement nécessaire pour générer les secrets et le développement local hors Docker. Tout le reste tourne dans Docker.

---

## Installation

### 1. Cloner le dépôt

```bash
git clone <url-du-repo>
cd BILLETIX
```

### 2. Créer le fichier d'environnement

```bash
cp .env.example .env
```

### 3. Générer les secrets cryptographiques

Lance ces commandes et colle chaque résultat dans le `.env` :

```bash
# JWT_ACCESS_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# JWT_REFRESH_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# QR_HMAC_SECRET — signature HMAC-SHA256 des QR codes
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# IBAN_ENCRYPTION_KEY — chiffrement AES-256 des coordonnées bancaires
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Remplir le `.env`

Variables obligatoires pour le démarrage :

```env
# Base de données
POSTGRES_USER=billetix
POSTGRES_PASSWORD=<mot_de_passe_fort>
POSTGRES_DB=billetix

# Cache
REDIS_PASSWORD=<mot_de_passe_fort>

# Message broker
RABBITMQ_USER=billetix
RABBITMQ_PASSWORD=<mot_de_passe_fort>

# Stockage fichiers
MINIO_ROOT_USER=billetix
MINIO_ROOT_PASSWORD=<minimum_8_caracteres>

# Secrets JWT (étape 3)
JWT_ACCESS_SECRET=<résultat_commande_1>
JWT_REFRESH_SECRET=<résultat_commande_2>

# Secrets sécurité (étape 3)
QR_HMAC_SECRET=<résultat_commande_3>
IBAN_ENCRYPTION_KEY=<résultat_commande_4>
```

> Les clés **Stripe**, **PayPal**, **SendGrid** et **Google OAuth** peuvent rester vides — ces intégrations ne sont pas encore actives.

---

## Démarrage

### Tout lancer en une commande

```bash
npm start
```

Démarre les 16 conteneurs : infrastructure (5) + microservices backend (10) + frontend (1).

### Autres modes

```bash
# Relance rapide sans rebuild (après npm start)
npm run dev

# Infrastructure seule — utile pour développer un service localement
npm run infra

# Mode production, conteneurs détachés (pas de logs en console)
npm run up:build
```

---

## URLs et ports

### Ports exposés sur la machine hôte

| Port | Service | URL | Description |
|---|---|---|---|
| **80** | Frontend (Next.js) | `http://localhost` | Application web |
| **3000** | api-gateway | `http://localhost:3000/api/docs` | API REST + Swagger |
| **5432** | PostgreSQL | — | Accès direct BDD (dev) |
| **6379** | Redis | — | Accès direct cache (dev) |
| **5672 / 15672** | RabbitMQ | `http://localhost:15672` | Broker + interface de gestion |
| **9000 / 9001** | MinIO | `http://localhost:9001` | Stockage S3 + console |
| **1025 / 8025** | MailHog | `http://localhost:8025` | SMTP dev + interface emails |

### Ports internes Docker (non accessibles depuis l'hôte)

Ces ports sont uniquement visibles sur le réseau interne `billetix-net` :

| Service | Port interne | Protocole |
|---|---|---|
| auth-service | 3001 | TCP |
| user-service | 3002 | TCP |
| event-service | 3003 | TCP |
| order-service | 3004 | TCP |
| ticket-service | 3005 | TCP |
| payment-service | 3006 | TCP |
| notification-service | 3007 | RabbitMQ |
| pdf-service | 3008 | RabbitMQ |
| admin-service | 3009 | TCP |

> Seuls **le port 80** (frontend) et **le port 3000** (api-gateway) sont les points d'entrée de l'application. Tous les autres services backend communiquent exclusivement entre eux via le réseau Docker interne.

---

## Commandes utiles

```bash
# Voir les logs d'un service spécifique
docker compose logs -f auth-service
docker compose logs -f api-gateway
docker compose logs -f order-service

# Voir les logs de tous les services
npm run logs

# Rebuild et redémarrer un seul service
docker compose up -d --build auth-service

# Accéder au shell d'un conteneur
docker compose exec auth-service sh
docker compose exec postgres psql -U billetix -d billetix

# Voir l'état de tous les conteneurs
npm run ps

# Arrêter tout (données conservées dans les volumes Docker)
npm run down

# Arrêter tout et supprimer les données — reset complet
npm run down:volumes
```

---

## Développement par service

Chaque microservice est autonome dans `backend/<nom-du-service>/`.

### Avec Docker (recommandé)

En mode `npm run dev`, les fichiers sources sont montés en volume — les services NestJS redémarrent automatiquement à chaque modification sans rebuild.

### Sans Docker (développement local)

Pour travailler sur un service directement avec Node.js :

```bash
# 1. Démarrer l'infrastructure (obligatoire)
npm run infra

# 2. Aller dans le service
cd backend/auth-service

# 3. Installer les dépendances
npm install

# 4. Démarrer en mode watch
npm run start:dev
```

Répéter l'étape 2-4 dans des terminaux séparés pour chaque service à développer simultanément.

### Ajouter un module dans un service

```bash
cd backend/auth-service
npx @nestjs/cli generate module users
npx @nestjs/cli generate service users
npx @nestjs/cli generate controller users
```

---

## Tests

Chaque service dispose de sa propre suite de tests.

```bash
# Tests unitaires d'un service
cd backend/auth-service
npm test

# Tests avec couverture
npm run test:cov

# Tests e2e
npm run test:e2e
```

> Les tests sont en cours de mise en place au fur et à mesure du développement des services.

---

## Variables d'environnement

Voir [`.env.example`](.env.example) pour la liste complète et documentée de toutes les variables, organisées par catégorie :
- PostgreSQL, Redis, RabbitMQ, MinIO, MailHog
- JWT (secrets, durées d'expiration)
- Sécurité (HMAC QR codes, chiffrement IBAN)
- OAuth Google, Stripe, PayPal
- Emails, URL de l'application
- Paramètres métier (commissions, délais)

---

## Suivi du projet

Voir [`README-ETAPE.md`](README-ETAPE.md) pour :
- L'audit complet du cahier des charges
- L'état d'avancement de chaque livrable
- Les points d'audit ouverts et résolus
- Le planning ajusté
