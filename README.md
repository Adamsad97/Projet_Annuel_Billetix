# BilletiX — Plateforme de Billetterie Électronique

Plateforme de vente de billets en ligne avec QR codes à usage unique et contrôle d'accès.
Architecture microservices, conteneurisée avec Docker, API REST documentée via Swagger.

## Démarrage rapide

```bash
cp .env.example .env   # copier et remplir les variables d'environnement
npm start              # construire et lancer toute l'application
```

Premier lancement : 5 à 10 minutes (téléchargement des images Docker + installation des dépendances). Relances suivantes : `npm run dev` (rapide, sans rebuild).

Une fois lancé : l'API est sur `http://localhost:4000` (documentation Swagger sur `http://localhost:4000/api/docs`), le frontend sur `http://localhost:3000`.

## Architecture

Le backend est composé de 10 microservices NestJS communiquant en interne via TCP (requêtes synchrones) et RabbitMQ (événements asynchrones : emails, génération de PDF), tous derrière une API Gateway unique qui est le seul point d'entrée HTTP public :

- **api-gateway** — point d'entrée HTTP, Swagger, authentification JWT
- **auth-service** — comptes, JWT, 2FA (TOTP/SMS), OAuth Google/Facebook
- **user-service** — profils acheteur/organisateur, KYC
- **event-service** — événements, catégories de billets, validation admin, catalogue
- **order-service** — tunnel d'achat, réservation de stock
- **ticket-service** — génération et vérification des billets (QR signé HMAC-SHA256), scan
- **payment-service** — paiement Stripe, reversements organisateurs
- **notification-service** — emails et SMS (consommateur RabbitMQ)
- **pdf-service** — génération des PDF billets et factures (consommateur RabbitMQ)
- **admin-service** — back-office, modération, configuration plateforme

Infrastructure partagée : PostgreSQL, Redis (cache/réservations), RabbitMQ (files d'attente), MinIO (stockage fichiers), MailHog (emails en développement).

## Installation

### 1. Créer le fichier d'environnement

```bash
cp .env.example .env
```

### 2. Générer les secrets cryptographiques

```bash
# JWT_ACCESS_SECRET et JWT_REFRESH_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# QR_HMAC_SECRET — signature des QR codes
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# IBAN_ENCRYPTION_KEY — chiffrement AES-256 des coordonnées bancaires
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Coller chaque résultat dans le `.env`, avec les mots de passe PostgreSQL/Redis/RabbitMQ/MinIO de ton choix.

Les clés Stripe, PayPal, SendGrid, Google/Facebook OAuth et Twilio peuvent rester vides si ces intégrations ne sont pas utilisées — voir `.env.example` pour la liste complète et documentée de toutes les variables.

## Commandes utiles

```bash
npm start                                   # tout construire et lancer
npm run dev                                 # relancer rapidement (sans rebuild)
npm run infra                                # infrastructure seule (dev d'un service en local)
npm run logs                                # logs de tous les services
npm run ps                                  # état de tous les conteneurs
npm run down                                # arrêter (données conservées)
npm run down:volumes                        # arrêter et effacer toutes les données

docker compose logs -f <service>            # logs d'un service précis
docker compose up -d --build <service>      # rebuild et redémarrer un seul service
docker compose exec <service> sh            # shell dans un conteneur
docker compose exec postgres psql -U billetix -d billetix   # accès direct à la base
```

## Développement sur un seul service

```bash
npm run infra              # démarrer l'infrastructure
cd backend/auth-service
npm install
npm run start:dev          # mode watch, sans Docker
```

## Tests

```bash
cd backend/auth-service
npm test                   # tests unitaires
npm run test:cov           # avec couverture
```

## Suivi du projet

Voir [`README-ETAPE.md`](README-ETAPE.md) pour l'état d'avancement par rapport au cahier des charges.
