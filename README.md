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

**Base de données** : rien à faire. Au démarrage, chaque service crée ses tables dans sa propre base (détail et mode production : section « Base de données et migrations »).

**9. Ouvrir le site** : http://localhost:3000 — se connecter avec le compte administrateur de l'étape 7.

## Adresses utiles

- Site : http://localhost:3000
- Documentation de l'API (Swagger) : http://localhost:4000/api/docs
- Emails envoyés par la plateforme (Mailpit) : http://localhost:8025
- Interface RabbitMQ : http://localhost:15672
- Console MinIO : http://localhost:9001

## Relancer et arrêter

- Relancer sans reconstruire : `docker compose up`
- Arrêter : `Ctrl+C`, puis `docker compose down`
- Repartir de bases vides (efface **toutes** les données) : `docker compose down -v`
- Afficher toutes les requêtes SQL pour déboguer : mettre `DB_LOGGING=true` dans `.env` puis relancer

---

# Commandes utiles

Noms des services : `api-gateway`, `auth-service`, `user-service`, `event-service`, `order-service`, `ticket-service`, `payment-service`, `notification-service`, `realtime-service`, `pdf-service`, `admin-service`, `frontend`.

- Démarrer tout en arrière-plan : `docker compose up -d`
- (Re)démarrer un seul service : `docker compose up -d --build <service>`
- Arrêter un seul service : `docker compose stop <service>`
- Suivre les logs d'un service : `docker compose logs -f <service>`
- État des conteneurs : `docker compose ps`
- Infrastructure seule (bases, Redis, RabbitMQ, MinIO, Mailpit) :

```powershell
docker compose up -d auth-db user-db event-db order-db ticket-db payment-db admin-db redis rabbitmq minio mailpit
```

Le fichier `.env` contient `COMPOSE_FILE=docker-compose.yml;docker-compose.dev.yml` : la configuration de développement est chargée automatiquement, sans `-f`. Elle expose aussi les ports des bases sur la machine (5432 à 5438).

# Base de données et migrations

Rien ne se passe à la construction des images : la base est préparée **au démarrage de chaque service**, selon `BACKEND_NODE_ENV` dans `.env`.

- **Développement (par défaut)**, `BACKEND_NODE_ENV` absent ou à `development` : `synchronize: true`, les tables sont créées et mises à jour depuis les entités ; les migrations ne sont pas exécutées.
- **Production**, `BACKEND_NODE_ENV=production` : `synchronize: false` et `migrationsRun: true`, chaque service applique ses migrations au démarrage.

Le mode production ne s'utilise que sur une **base neuve** : une base créée en développement n'a pas d'historique de migrations, et `migration:run` y échoue avec `already exists` (`code: 42710`).

Services ayant leur propre base : `auth-service`, `user-service`, `event-service`, `order-service`, `ticket-service`, `payment-service`, `admin-service`.

- Appliquer les migrations d'un service : `docker compose exec <service> npm run migration:run`
- Générer une migration après une modification d'entité (service lancé hors Docker, voir plus bas) : `npm run migration:generate`
- Annuler la dernière migration : `npm run migration:revert`

# Tests

Les tests unitaires n'ont besoin ni de Docker ni de base de données (tout est simulé). Ils se lancent depuis le code source :

```powershell
cd backend/<service>
npm install --legacy-peer-deps
npm test
```

Tous les services d'un coup (après le `npm install --legacy-peer-deps` dans chacun) : `npm run test:all:local` depuis la racine.

`--legacy-peer-deps` est obligatoire : un simple `npm install` échoue sur un conflit de dépendances connu (`@nestjs/config@3.3.0` contre `@nestjs/common@11`), contourné de la même façon dans les Dockerfiles et la CI.

# Développer un service sans Docker

Pour profiter du rechargement à chaud, un service peut tourner directement avec Node pendant que l'infrastructure reste dans Docker.

1. Démarrer l'infrastructure seule (voir « Commandes utiles »).
2. Copier la configuration dans le dossier du service : `Copy-Item .env backend/<service>/.env`.
3. Dans ce `.env`, remplacer les noms d'hôte Docker par `localhost` et les ports par ceux exposés sur la machine, par exemple `@auth-db:5432` devient `@localhost:5432`, `@redis:6379` devient `@localhost:6379`, `@rabbitmq:5672` devient `@localhost:5672` (correspondance complète dans `docker-compose.dev.yml`).
4. Lancer le service :

```powershell
cd backend/<service>
npm install --legacy-peer-deps
npm run start:dev
```

Pour le frontend : `cd frontend`, `npm install`, puis `npm run dev`.

Pour lancer tous les services backend dans un seul terminal (étapes 2 à 4 faites pour chacun) : `npm run dev:all`. `Ctrl+C` les arrête tous.
