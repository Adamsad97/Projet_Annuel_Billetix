# BilletiX — Plateforme de Billetterie Électronique

Backend en microservices NestJS (10 services + API Gateway), une base PostgreSQL dédiée par service, frontend Next.js.

> Les commandes ci-dessous évitent volontairement `&&` pour enchaîner deux commandes (`cd dossier && npm test`) : ça ne fonctionne pas dans Windows PowerShell par défaut (seulement dans PowerShell 7+ ou Git Bash). Chaque étape est sur sa propre ligne — copiez-collez-les une par une, ça marche dans n'importe quel terminal (PowerShell, cmd, bash).

## 1. Cloner le projet

```bash
git clone https://github.com/Adamsad97/Projet_Annuel_Billetix.git
cd Projet_Annuel_Billetix
```

## 2. Créer le fichier d'environnement

```bash
cp .env.example .env
```

Ouvrir `.env` et renseigner au minimum les secrets cryptographiques (voir les commentaires dans `.env.example` pour la commande de génération de chacun) : `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `QR_HMAC_SECRET`, `IBAN_ENCRYPTION_KEY`, ainsi que les mots de passe PostgreSQL/Redis/RabbitMQ/MinIO de votre choix. Les clés Stripe, PayPal, SendGrid et Google/Facebook OAuth peuvent rester vides si ces intégrations ne sont pas utilisées.

---

# Partie A — Avec Docker (recommandé)

Toute l'infrastructure (7 bases PostgreSQL, Redis, RabbitMQ, MinIO, MailHog) ET les 10 microservices tournent en conteneurs. C'est le mode par défaut du projet.

## A.1 Premier démarrage

```bash
npm start
```

Premier lancement : 5 à 10 minutes (téléchargement des images Docker + installation des dépendances de chaque service). Une fois démarré :

- API : http://localhost:4000
- Documentation Swagger : http://localhost:4000/api/docs
- Frontend : http://localhost:3000
- Interface RabbitMQ : http://localhost:15672
- Console MinIO : http://localhost:9001
- MailHog (emails de dev) : http://localhost:8025

## A.2 Démarrer un service en particulier

> Le fichier `.env` (créé à l'étape 2) contient `COMPOSE_FILE=docker-compose.yml;docker-compose.dev.yml` : Docker charge donc automatiquement la config dev (rechargement à chaud), sans avoir besoin de répéter `-f` à chaque commande. Testé en conditions réelles : sans ce réglage, Docker recrée le conteneur en config **production**.

```bash
docker compose up -d <nom-du-service>
```

| Service | Commande |
|---|---|
| api-gateway | `docker compose up -d api-gateway` |
| auth-service | `docker compose up -d auth-service` |
| user-service | `docker compose up -d user-service` |
| event-service | `docker compose up -d event-service` |
| order-service | `docker compose up -d order-service` |
| ticket-service | `docker compose up -d ticket-service` |
| payment-service | `docker compose up -d payment-service` |
| notification-service | `docker compose up -d notification-service` |
| pdf-service | `docker compose up -d pdf-service` |
| admin-service | `docker compose up -d admin-service` |
| frontend | `docker compose up -d frontend` |

## A.3 Arrêter un service en particulier

```bash
docker compose down <nom-du-service>
```

| Service | Commande |
|---|---|
| api-gateway | `docker compose down api-gateway` |
| auth-service | `docker compose down auth-service` |
| user-service | `docker compose down user-service` |
| event-service | `docker compose down event-service` |
| order-service | `docker compose down order-service` |
| ticket-service | `docker compose down ticket-service` |
| payment-service | `docker compose down payment-service` |
| notification-service | `docker compose down notification-service` |
| pdf-service | `docker compose down pdf-service` |
| admin-service | `docker compose down admin-service` |
| frontend | `docker compose down frontend` |

(`docker compose down <service>` arrête **et supprime** le conteneur, il est recréé proprement au prochain `up`. Pour juste le mettre en pause sans le supprimer : `docker compose stop <nom-du-service>`.)

## A.4 Démarrer tous les services en une seule commande

Tout (backend + frontend), premier démarrage :

```bash
npm start
```

Relance rapide sans reconstruire les images (après un premier `npm start`) :

```bash
npm run dev
```

> ⚠️ Testé en conditions réelles : `npm start` et `npm run dev` restent **attachés aux logs** (pas de `-d`). Fermer le terminal, ou tuer le processus, arrête **toute la stack** (confirmé : la stack est passée de 22 conteneurs à 0 quand ce processus s'est terminé). Pour démarrer en arrière-plan sans dépendre du terminal : `npm run up` (équivalent détaché).

Backend seul (les 10 microservices + infrastructure, sans le frontend), testé en conditions réelles :

```bash
npm run dev:backend
```

Frontend seul :

```bash
npm run dev:frontend
```

Infrastructure seule (bases de données, Redis, RabbitMQ, MinIO, MailHog) :

```bash
npm run infra
```

## A.5 Arrêter tous les services en une seule commande

```bash
npm run down
```

Arrêter et effacer aussi toutes les données (bases de données, files RabbitMQ, fichiers MinIO) :

```bash
npm run down:volumes
```

## A.6 Lancer les tests d'un service en particulier

Le service doit déjà être démarré (A.1/A.2) — les dépendances sont installées dans le conteneur, pas besoin de `node_modules` en local. Testé en conditions réelles sur `pdf-service` (10/10 tests passés) :

```bash
npm run test:<nom-du-service>
```

| Service | Commande |
|---|---|
| api-gateway | `npm run test:api-gateway` |
| auth-service | `npm run test:auth-service` |
| user-service | `npm run test:user-service` |
| event-service | `npm run test:event-service` |
| order-service | `npm run test:order-service` |
| ticket-service | `npm run test:ticket-service` |
| payment-service | `npm run test:payment-service` |
| notification-service | `npm run test:notification-service` |
| pdf-service | `npm run test:pdf-service` |
| admin-service | `npm run test:admin-service` |

## A.7 Lancer tous les tests en une seule commande

Les services doivent déjà être démarrés (A.1/A.4) :

```bash
npm run test:all
```

Exécute `npm test` dans chacun des 10 microservices via `docker compose exec` (comme A.6), dans l'ordre, et rapporte en fin d'exécution la liste des services en échec (s'il y en a).

## A.8 Exécuter les migrations

Les migrations s'exécutent **automatiquement** au démarrage de chaque service en conteneur (`NODE_ENV=production` déclenche `migrationsRun: true`) — rien à faire manuellement dans ce mode.

Pour forcer une migration manuellement (ex: après avoir ajouté une migration sans redémarrer le conteneur) :

```bash
docker compose exec <nom-du-service> npm run migration:run
```

Services concernés (7, ceux ayant leur propre base) : `auth-service`, `user-service`, `event-service`, `order-service`, `ticket-service`, `payment-service`, `admin-service`.

> ⚠️ Testé en conditions réelles : en mode dev (`docker-compose.dev.yml`), `synchronize: true` a déjà créé toutes les tables/enums directement depuis les entités — il n'existe donc aucun historique de migrations appliquées dans la base. Lancer `migration:run` dans ce mode échoue avec une erreur Postgres du type `already exists` (`code: 42710`). C'est normal, pas un bug : les migrations manuelles ne servent que sur une base **neuve** ou en environnement **production** (`synchronize: false`).

---

# Partie B — Sans Docker (services en local)

Les 10 microservices tournent directement avec Node (`npm run start:dev`), hors conteneur. **L'infrastructure (bases de données, Redis, RabbitMQ, MinIO) continue de tourner via Docker** — ce projet ne prévoit pas d'installation native de 7 PostgreSQL + Redis + RabbitMQ + MinIO, seuls les microservices eux-mêmes sortent des conteneurs. Utile pour développer un service avec rechargement à chaud sans reconstruire d'image.

## B.1 Démarrer l'infrastructure requise

```bash
npm run infra
```

Démarre les 7 bases PostgreSQL, Redis, RabbitMQ, MinIO et MailHog en conteneurs, avec leurs ports exposés sur l'hôte (5432 à 5438 pour les bases, 6379, 5672/15672, 9000/9001, 1025/8025).

## B.2 Configurer les variables d'environnement du service

`ConfigModule` de NestJS charge un `.env` depuis le dossier **courant** du service (pas celui de la racine). Dans le terminal où vous allez lancer le service :

```bash
cd backend/<nom-du-service>
cp ../../.env .env
```

Puis, dans ce `.env` local, remplacer les noms d'hôte Docker par `localhost` et les ports internes par les ports exposés côté hôte (ex: `DATABASE_URL=postgresql://...@auth-db:5432/auth` devient `DATABASE_URL=postgresql://...@localhost:5432/auth`, `REDIS_URL=redis://...@redis:6379` devient `redis://...@localhost:6379`, `RABBITMQ_URL=amqp://...@rabbitmq:5672` devient `amqp://...@localhost:5672`). Voir la table de correspondance base ↔ port en A.2 / `docker-compose.dev.yml`.

## B.3 Installer les dépendances et démarrer un service en particulier

> ⚠️ Testé en conditions réelles : un `npm install` seul échoue avec un conflit `ERESOLVE` (`@nestjs/config@3.3.0` vs `@nestjs/common@11`, un conflit de peer-dependencies déjà présent dans le repo). C'est pour ça que tous les Dockerfiles et la CI utilisent `--legacy-peer-deps` — il faut faire pareil en local :

```bash
cd backend/<nom-du-service>
npm install --legacy-peer-deps
npm run start:dev
```

| Service | Aller dans le dossier |
|---|---|
| api-gateway | `cd backend/api-gateway` |
| auth-service | `cd backend/auth-service` |
| user-service | `cd backend/user-service` |
| event-service | `cd backend/event-service` |
| order-service | `cd backend/order-service` |
| ticket-service | `cd backend/ticket-service` |
| payment-service | `cd backend/payment-service` |
| notification-service | `cd backend/notification-service` |
| pdf-service | `cd backend/pdf-service` |
| admin-service | `cd backend/admin-service` |
| frontend | `cd frontend` |

Puis, dans chaque cas (une seule fois) :
- pour un microservice backend : `npm install --legacy-peer-deps`
- pour le frontend : `npm install` (pas de conflit de dépendances côté Next.js)

Puis `npm run start:dev` (`npm run dev` pour le frontend). Chaque service tourne au premier plan dans son propre terminal (rechargement automatique à chaque modification du code).

## B.4 Arrêter un service en particulier

Le service tourne au premier plan : `Ctrl+C` dans le terminal correspondant.

## B.5 Démarrer tous les services en une seule commande

Il n'existe pas aujourd'hui de commande unique pour lancer les 10 services en local hors Docker (chacun bloque son terminal en mode watch). Deux options :
- ouvrir un terminal par service et lancer la commande B.3 dans chacun,
- utiliser un multiplexeur de terminal (`tmux`, onglets du terminal de votre éditeur, etc.).

Dites-moi si vous voulez qu'un script (type `concurrently`) soit ajouté pour lancer les 10 en arrière-plan avec un seul `npm run dev:all`.

## B.6 Arrêter tous les services en une seule commande

`Ctrl+C` dans chaque terminal ouvert (cf. B.5) — ou fermer les terminaux. Pour arrêter l'infrastructure Docker restée active :

```bash
npm run infra:down
```

## B.7 Lancer les tests d'un service en particulier

Identique avec ou sans Docker (les tests unitaires ne nécessitent ni conteneur ni base de données — tout est mocké) :

```bash
npm test --prefix backend/<nom-du-service>
```

## B.8 Lancer tous les tests en une seule commande

Nécessite un `npm install --legacy-peer-deps` déjà fait dans chacun des 10 services (cf. B.3) :

```bash
npm run test:all:local
```

## B.9 Exécuter les migrations

> ⚠️ Même remarque qu'en A.8 : ça ne fonctionne que sur une base neuve (jamais synchronisée par TypeORM) ou en environnement `synchronize: false`.

Avec l'infrastructure démarrée (B.1) et le `.env` local configuré (B.2) :

```bash
cd backend/<nom-du-service>
npm run migration:run
```

Toutes en une seule commande (nécessite un `.env` local dans chacun des 7 services concernés, cf. B.2) :

```bash
npm run migrate:all
```

Autres commandes utiles : `npm run migration:generate` (génère une migration à partir des changements d'entités), `npm run migration:revert` (annule la dernière migration).
