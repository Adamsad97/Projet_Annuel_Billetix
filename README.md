# BilleTix — Plateforme de Billetterie Électronique

Backend en microservices NestJS (10 services + API Gateway), une base PostgreSQL dédiée par service, frontend Next.js.

# Démarrage rapide

Toutes les étapes pour lancer le projet à partir d'un dépôt fraîchement cloné. Les commandes sont données pour Windows (PowerShell) ; les différences pour macOS/Linux sont indiquées.

## Prérequis

À installer une seule fois :

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) 22 ou plus (sert uniquement à générer les clés de l'étape 4 à 6)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/), **lancé** avant l'étape 8

## Étapes

**1. Cloner le dépôt**

```powershell
git clone https://github.com/Adamsad97/Projet_Annuel_Billetix.git
```

**2. Entrer dans le dossier**

```powershell
cd Projet_Annuel_Billetix
```

**3. Créer le fichier d'environnement**

```powershell
Copy-Item .env.example .env
```

macOS/Linux : `cp .env.example .env`, puis remplacer le `;` de la première ligne par `:` (`COMPOSE_FILE=docker-compose.yml:docker-compose.dev.yml`), sinon Docker ne charge pas la configuration de développement.

**4. Générer les deux secrets JWT** (lancer la commande deux fois)

```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copier les deux résultats dans `JWT_ACCESS_SECRET` et `JWT_REFRESH_SECRET` du fichier `.env`.

**5. Générer la clé de chiffrement des IBAN** (AES-256)

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copier le résultat dans `IBAN_ENCRYPTION_KEY`.

**6. Générer la clé de signature des QR codes** (Ed25519)

```powershell
node -e "console.log(require('crypto').generateKeyPairSync('ed25519').privateKey.export({format:'der',type:'pkcs8'}).toString('base64'))"
```

Copier le résultat dans `QR_SIGNING_PRIVATE_KEY`.

**7. Compléter le reste de `.env`**

```powershell
notepad .env
```

- Remplacer les mots de passe `changeme_...` (PostgreSQL, Redis, RabbitMQ, MinIO) par des valeurs de votre choix — 8 caractères minimum pour MinIO.
- Choisir `BOOTSTRAP_ADMIN_EMAIL` et `BOOTSTRAP_ADMIN_PASSWORD` : compte administrateur créé automatiquement au premier démarrage.
- Paiements : renseigner les clés Stripe **de test** (`sk_test_...`, `pk_test_...`, `whsec_...`). Les clés Google/Facebook peuvent rester telles quelles si la connexion sociale n'est pas testée.

**8. Construire et lancer le projet**

```powershell
docker compose up --build
```

Premier lancement : 5 à 10 minutes (téléchargement des images, installation des dépendances). Le projet est prêt quand tous les conteneurs sont « Healthy » et que la ligne `[API Gateway] En écoute sur le port 4000` apparaît.

**Base de données** : rien à faire. Au démarrage, chaque service crée ses tables dans sa propre base (voir A.8 pour le détail et le mode production).

**9. Ouvrir le site** : http://localhost:3000 — se connecter avec le compte administrateur de l'étape 7.

## Adresses utiles

| Outil | Adresse |
|---|---|
| Site | http://localhost:3000 |
| Documentation de l'API (Swagger) | http://localhost:4000/api/docs |
| Emails envoyés par la plateforme (Mailpit) | http://localhost:8025 |
| Interface RabbitMQ | http://localhost:15672 |
| Console MinIO | http://localhost:9001 |

## Relancer et arrêter

- Relancer sans reconstruire : `docker compose up`
- Arrêter : `Ctrl+C`, puis `docker compose down`
- Repartir de bases vides (efface **toutes** les données) : `docker compose down -v`
- Afficher toutes les requêtes SQL pour déboguer : mettre `DB_LOGGING=true` dans `.env` puis relancer

---

# Partie A — Avec Docker (recommandé)

Toute l'infrastructure (7 bases PostgreSQL, Redis, RabbitMQ, MinIO, Mailpit) ET les 11 microservices tournent en conteneurs. C'est le mode par défaut du projet.

## A.1 Premier démarrage

Suivre le **démarrage rapide** en haut de ce document (étape 8 : `docker compose up --build`). Une fois démarré :

- API (healthcheck) : http://localhost:4000/health — `http://localhost:4000` seul renvoie 404, aucune route n'est déclarée sur `/`
- Documentation Swagger (liste de toutes les routes) : http://localhost:4000/api/docs
- Frontend : http://localhost:3000
- Interface RabbitMQ : http://localhost:15672
- Console MinIO : http://localhost:9001
- Mailpit (emails de dev) : http://localhost:8025

## A.2 Démarrer un service en particulier

> Le fichier `.env` (créé à l'étape 3 du démarrage rapide) contient `COMPOSE_FILE=docker-compose.yml;docker-compose.dev.yml` : Docker charge donc automatiquement la config dev, sans avoir besoin de répéter `-f` à chaque commande. Testé en conditions réelles : sans ce réglage, Docker recrée le conteneur en config **production**.

```bash
docker compose up -d <nom-du-service>
```

api-gateway : `docker compose up -d api-gateway`  
auth-service : `docker compose up -d auth-service`  
user-service : `docker compose up -d user-service`  
event-service : `docker compose up -d event-service`  
order-service : `docker compose up -d order-service`  
ticket-service : `docker compose up -d ticket-service`  
payment-service : `docker compose up -d payment-service`  
notification-service : `docker compose up -d notification-service`  
realtime-service : `docker compose up -d realtime-service`
pdf-service : `docker compose up -d pdf-service`  
admin-service : `docker compose up -d admin-service`  
frontend : `docker compose up -d frontend`

## A.3 Arrêter un service en particulier

```bash
docker compose down <nom-du-service>
```

api-gateway : `docker compose down api-gateway`  
auth-service : `docker compose down auth-service`  
user-service : `docker compose down user-service`  
event-service : `docker compose down event-service`  
order-service : `docker compose down order-service`  
ticket-service : `docker compose down ticket-service`  
payment-service : `docker compose down payment-service`  
notification-service : `docker compose down notification-service`  
realtime-service : `docker compose down realtime-service`
pdf-service : `docker compose down pdf-service`  
admin-service : `docker compose down admin-service`  
frontend : `docker compose down frontend`

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

> Testé en conditions réelles : `npm start` et `npm run dev` restent **attachés aux logs** (pas de `-d`). Fermer le terminal, ou tuer le processus, arrête **toute la stack** (confirmé : la stack est passée de 22 conteneurs à 0 quand ce processus s'est terminé). Pour démarrer en arrière-plan sans dépendre du terminal : `npm run up` (équivalent détaché).

Backend seul (les 11 microservices + infrastructure, sans le frontend), testé en conditions réelles :

```bash
npm run dev:backend
```

Frontend seul :

```bash
npm run dev:frontend
```

Infrastructure seule (bases de données, Redis, RabbitMQ, MinIO, Mailpit) :

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

api-gateway : `npm run test:api-gateway`  
auth-service : `npm run test:auth-service`  
user-service : `npm run test:user-service`  
event-service : `npm run test:event-service`  
order-service : `npm run test:order-service`  
ticket-service : `npm run test:ticket-service`  
payment-service : `npm run test:payment-service`  
notification-service : `npm run test:notification-service`  
realtime-service : `npm run test:realtime-service`
pdf-service : `npm run test:pdf-service`  
admin-service : `npm run test:admin-service`

## A.7 Lancer tous les tests en une seule commande

Les services doivent déjà être démarrés (A.1/A.4) :

```bash
npm run test:all
```

Exécute `npm test` dans chacun des 11 microservices via `docker compose exec` (comme A.6), dans l'ordre, et rapporte en fin d'exécution la liste des services en échec (s'il y en a).

## A.8 Exécuter les migrations

Rien ne se passe à la construction des images : la base est préparée **au démarrage de chaque service**, selon `BACKEND_NODE_ENV` dans `.env`.

| Mode | Réglage | Schéma de la base |
|---|---|---|
| Développement (par défaut) | `BACKEND_NODE_ENV` absent ou `development` | `synchronize: true` : tables créées et mises à jour depuis les entités, migrations non exécutées |
| Production | `BACKEND_NODE_ENV=production` | `synchronize: false` et `migrationsRun: true` : chaque service applique ses migrations au démarrage |

Le mode production ne s'utilise que sur une **base neuve** : une base créée en développement n'a pas d'historique de migrations (voir la remarque ci-dessous).

Pour forcer une migration manuellement (ex: après avoir ajouté une migration sans redémarrer le conteneur) :

```bash
docker compose exec <nom-du-service> npm run migration:run
```

Services concernés (7, ceux ayant leur propre base) : `auth-service`, `user-service`, `event-service`, `order-service`, `ticket-service`, `payment-service`, `admin-service`.

> Testé en conditions réelles : en mode dev (`docker-compose.dev.yml`), `synchronize: true` a déjà créé toutes les tables/enums directement depuis les entités — il n'existe donc aucun historique de migrations appliquées dans la base. Lancer `migration:run` dans ce mode échoue avec une erreur Postgres du type `already exists` (`code: 42710`). C'est normal, pas un bug : les migrations manuelles ne servent que sur une base **neuve** ou en environnement **production** (`synchronize: false`).

---

# Partie B — Sans Docker (services en local)

Les 10 microservices tournent directement avec Node (`npm run start:dev`), hors conteneur. **L'infrastructure (bases de données, Redis, RabbitMQ, MinIO) continue de tourner via Docker** — ce projet ne prévoit pas d'installation native de 7 PostgreSQL + Redis + RabbitMQ + MinIO, seuls les microservices eux-mêmes sortent des conteneurs. Utile pour développer un service avec rechargement à chaud sans reconstruire d'image.

## B.1 Démarrer l'infrastructure requise

```bash
npm run infra
```

Démarre les 7 bases PostgreSQL, Redis, RabbitMQ, MinIO et Mailpit en conteneurs, avec leurs ports exposés sur l'hôte (5432 à 5438 pour les bases, 6379, 5672/15672, 9000/9001, 1025/8025).

## B.2 Configurer les variables d'environnement du service

`ConfigModule` de NestJS charge un `.env` depuis le dossier **courant** du service (pas celui de la racine). Dans le terminal où vous allez lancer le service :

```bash
cd backend/<nom-du-service>
cp ../../.env .env
```

Puis, dans ce `.env` local, remplacer les noms d'hôte Docker par `localhost` et les ports internes par les ports exposés côté hôte (ex: `DATABASE_URL=postgresql://...@auth-db:5432/auth` devient `DATABASE_URL=postgresql://...@localhost:5432/auth`, `REDIS_URL=redis://...@redis:6379` devient `redis://...@localhost:6379`, `RABBITMQ_URL=amqp://...@rabbitmq:5672` devient `amqp://...@localhost:5672`). Voir la table de correspondance base ↔ port en A.2 / `docker-compose.dev.yml`.

## B.3 Installer les dépendances et démarrer un service en particulier

> Testé en conditions réelles : un `npm install` seul échoue avec un conflit `ERESOLVE` (`@nestjs/config@3.3.0` vs `@nestjs/common@11`, un conflit de peer-dependencies déjà présent dans le repo). C'est pour ça que tous les Dockerfiles et la CI utilisent `--legacy-peer-deps` — il faut faire pareil en local :

```bash
cd backend/<nom-du-service>
npm install --legacy-peer-deps
npm run start:dev
```

api-gateway : `cd backend/api-gateway`  
auth-service : `cd backend/auth-service`  
user-service : `cd backend/user-service`  
event-service : `cd backend/event-service`  
order-service : `cd backend/order-service`  
ticket-service : `cd backend/ticket-service`  
payment-service : `cd backend/payment-service`  
notification-service : `cd backend/notification-service`  
realtime-service : `cd backend/realtime-service`
pdf-service : `cd backend/pdf-service`  
admin-service : `cd backend/admin-service`  
frontend : `cd frontend`

Puis, dans chaque cas (une seule fois) :

- pour un microservice backend : `npm install --legacy-peer-deps`
- pour le frontend : `npm install` (pas de conflit de dépendances côté Next.js)

Puis `npm run start:dev` (`npm run dev` pour le frontend). Chaque service tourne au premier plan dans son propre terminal (rechargement automatique à chaque modification du code).

## B.4 Arrêter un service en particulier

Le service tourne au premier plan : `Ctrl+C` dans le terminal correspondant.

## B.5 Démarrer tous les services en une seule commande

Nécessite que chaque service ait déjà son `.env` local (B.2) et ses dépendances installées (B.3) :

```bash
npm run dev:all
```

Lance les 11 microservices backend en parallèle (`npm run start:dev` dans chacun), logs préfixés par nom de service dans un seul terminal. `Ctrl+C` arrête tous les processus d'un coup.

## B.6 Arrêter tous les services en une seule commande

`Ctrl+C` dans le terminal (que ce soit `npm run dev:all` ou un terminal par service, cf. B.4/B.5). Pour arrêter l'infrastructure Docker restée active :

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

> Même remarque qu'en A.8 : ça ne fonctionne que sur une base neuve (jamais synchronisée par TypeORM) ou en environnement `synchronize: false`.

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
