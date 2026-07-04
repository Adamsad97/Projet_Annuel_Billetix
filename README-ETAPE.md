# AUDIT BILLETIX — Backend (hors front/mobile) — mise à jour 2026-07-04

> Document vivant de suivi. À mettre à jour à chaque avancée (résolution d'un point, démarrage d'une phase, décision prise).
> Périmètre de cet audit : **backend uniquement** (10 microservices + API Gateway). Le frontend web et l'application mobile de contrôle sont exclus de la liste ci-dessous (voir note en fin de document).
> Référence : `CAHIER DES CHARGES — Plateforme de Billetterie Électronique v1.0` (mai 2026).
> Légende : ✅ Fait — ⚠️ Partiel — ❌ Manquant

---

## Résumé exécutif

Le backend couvre correctement le cœur métier (comptes, événements, achat, billets QR, paiement, reversements, notifications) et une bonne partie de la sécurité de base. Il reste deux catégories de travail avant une mise en production sérieuse :

1. **Fonctionnel** — des fonctionnalités du CDC encore absentes ou partielles (moyens de paiement alternatifs, KPIs admin, exports comptables, certaines notifications, RGPD).
2. **Industrialisation / qualité professionnelle** — c'est le point le plus critique actuellement : **aucun test automatisé, aucune migration de base de données, aucun pipeline CI/CD**. Le point des migrations est bloquant : `synchronize` est désactivé en production dans les 10 services (bonne pratique) mais aucune migration n'existe pour créer le schéma → **une mise en production telle quelle démarrerait avec une base de données vide et cassée**.

---

## 🚨 Découverte critique du 2026-07-04 : le backend ne démarrait pas réellement

En vérifiant les conteneurs Docker en cours d'exécution (pas seulement le code), il s'est avéré que **la quasi-totalité des microservices ne démarrait jamais avec succès** — erreurs de compilation TypeScript, dépendances déclarées mais jamais installées, et surtout des **bugs d'injection de dépendances NestJS** (un module féature injecte un client `XXX_SERVICE` ou un service d'un autre module sans l'importer/exporter correctement — invisible tant qu'une erreur de compilation empêchait même d'atteindre cette étape). Résultat concret : `event-service`, `user-service`, `ticket-service`, `order-service` et `api-gateway` créaient leurs tables en base **pour la toute première fois** au moment de la correction. Autrement dit, une bonne partie de ce qui était marqué "✅ Fait" dans les audits précédents avait un code correct mais n'avait **jamais tourné**.

Corrigé :
- `user-service` : variable d'env `IBAN_ENCRYPTION_KEY` (le code lisait `ENCRYPTION_KEY`)
- `order-service`, `event-service` : generic manquant sur `config.get<string>()` (erreur de type RabbitMQ)
- `order-service`, `payment-service` : `@nestjs/schedule` incompatible avec NestJS 11, bump vers `^5.0.1`
- `payment-service` : version d'API Stripe non supportée par le SDK installé
- `notification-service` : chemin d'import cassé pour `HandlebarsAdapter`
- `auth-service`, `api-gateway` : dépendances déclarées mais jamais installées (`otplib`, `qrcode`, `@aws-sdk/client-s3`, `multer`, `amqplib`)
- **Bugs de DI récurrents** (module féature n'exportant/n'importimportant pas un provider utilisé ailleurs) : `EventModule` (NOTIFICATION_SERVICE), `ScanModule` (export manquant de `ScanService` pour `OfflineSyncModule`), `StockReservationModule` (EVENT_SERVICE), `ReminderModule` (NOTIFICATION_SERVICE), `EventsModule`/gateway WebSocket (JwtService)
- **Refactor structurel côté api-gateway** : les 9 clients TCP/RMQ étaient enregistrés uniquement au niveau `AppModule`, invisibles pour les modules féatures (cause racine de plusieurs bugs ci-dessus côté gateway, ex. `UserModule`). Extraits dans un nouveau module `MicroserviceClientsModule` marqué `@Global()`, à l'image de `PlatformConfigModule` déjà utilisé ailleurs — élimine toute la classe de bug pour l'API Gateway.

**Résultat** : les 10 microservices + la gateway démarrent maintenant tous proprement (`Nest application/microservice successfully started`).

## 🐛 Bugs corrigés le 2026-07-04 (session en cours)

- **Routes admin cassées (RPC sans handler)** — `user.suspend`/`user.unsuspend`/`user.change_role` envoyées au mauvais microservice (USER_SERVICE au lieu d'AUTH_SERVICE, où vit réellement l'entité `User`) ; `payment.get_all_disputes` sans handler. → Corrigé.
- **Commissions jamais calculées dynamiquement** — taux standard/dégressif (>1000 places) et exonération non lucratif (0%, appliquée à la validation admin) désormais calculés via `platform-config`, plus de taux figé. → Corrigé.
- **Aucun scheduler de reversement** — nouveau cron quotidien (`payment-service/src/scheduler/`) qui traite les payouts échus, avec vérification Stripe Connect onboardé + KYC validé. → Corrigé.
- **2FA jamais vérifiée au login** — `AuthService.login()` ignorait totalement `two_factor_enabled`. → Corrigé (`requires_2fa` + `totp_code`). IBAN désormais bloqué sans 2FA activée.
- **Faille d'autorisation sur l'annulation d'événement** — un organisateur pouvait annuler l'événement d'un autre en fournissant simplement un motif (le motif servait de contournement d'autorisation). → Corrigé avec un flag `isAdmin` réel basé sur le rôle JWT.
- **Crash sur `/admin/events/:id/reject` et `/admin/events/:id/cancel`** — payloads mal formés vers event-service (`TypeError` garanti à l'exécution). → Corrigé.
- **Emails organisateur (validation/rejet/suspension) silencieusement jamais envoyés** — mauvais format de payload vers notification-service (manquait `email`/`firstName`). → Corrigé. Un doublon d'email (approve/reject envoyés deux fois) a aussi été supprimé.
- **Correction d'audit** : contrairement à une conclusion précédente, le remboursement automatique intégral en cas d'annulation par l'organisateur **existe et fonctionne** (`api-gateway/src/event/event.controller.ts::refundAllOrdersForEvent`, cascade par commande avec remboursement Stripe + email acheteur). L'audit du 2026-07-03 l'avait classé à tort comme manquant.

---

## 1. Comptes, authentification, profils

**Fait**

- Inscription (nom/prénom/email/password/rôle), vérification email par lien, mot de passe oublié, JWT access/refresh configurables, bcrypt coût 12.
- OAuth Google fonctionnel.
- 2FA TOTP complète (setup/confirm/verify/disable) **et désormais appliquée au login**.
- IBAN organisateur chiffré AES-256-GCM, **désormais impossible à enregistrer sans 2FA activée**.
- Profil acheteur (infos, adresse facturation, historique commandes).
- Profil organisateur (entité, réseaux sociaux, IBAN, KYC avec statuts + validation admin).
- Suspension/désuspension de compte et changement de rôle par l'admin (corrigé aujourd'hui).

**Reste à faire**

- OAuth Facebook (enum présent, aucune stratégie implémentée).
- 2FA par SMS (seul TOTP est implémenté).
- Renvoi de billets par email depuis l'espace acheteur (aucune route).
- Téléchargement de facture côté acheteur (`invoice_url` existe côté order-service mais n'est jamais généré/rempli, et n'est pas exposé par la gateway).
- Tableau de bord / statistiques temps réel pour l'organisateur (aucune route dédiée).
- Recherche/liste globale des utilisateurs côté admin.
- Suppression de compte (droit à l'effacement RGPD).

## 2. Gestion des événements

**Fait**

- Création d'événement complète (titre, description, catégorie, dates, lieu, géoloc, jauge, dates de vente, politique de remboursement, conditions d'accès).
- Upload d'affiche sur MinIO (5 Mo, JPG/PNG).
- Catégories de billets complètes (prix, quota, visibilité publique/code promo/cachée, limite par commande, dates de validité multi-jours).
- Workflow de validation DRAFT → PENDING → PUBLISHED/DRAFT(rejeté)/SUSPENDED/CANCELLED, demande d'informations complémentaires, notifications email (corrigées aujourd'hui).
- Catalogue public avec filtres catégorie/ville et pagination.
- Codes promo (création, validation, application dans le tunnel, désactivation).

**Reste à faire**

- Description riche (WYSIWYG) — actuellement texte simple.
- Carte interactive / géocodage automatique de l'adresse.
- Délai réglementaire de 48h ouvrées pour le traitement admin (avec suspension du délai pendant une demande d'info).
- Transition automatique vers TERMINATED/ARCHIVED après la date de l'événement (les statuts existent, aucun cron ne les déclenche).
- Critères de validation formalisés (le code ne vérifie que le statut, pas la cohérence des informations).
- Recherche par mots-clés et filtres avancés (prix min/max, distance géographique) dans le catalogue.
- Modification/report d'un événement après publication ; événements récurrents/multi-représentations.

## 3. Achat, commandes, billets

**Fait**

- Réservation de stock atomique anti-survente (UPDATE SQL conditionnel — fonctionnellement équivalent à un verrou, même si pas via Redis SETNX comme initialement prévu).
- Commandes : identifiant unique, statuts complets, historique acheteur.
- Paiement Stripe (PaymentIntent, webhook signé, anti-doublon).
- Remboursement automatique intégral en cas d'annulation d'un événement (cascade acheteur par acheteur, voir correction d'audit ci-dessus).
- Génération de billets PDF individuels avec tout le contenu requis (QR, nom, date, lieu, catégorie, acheteur nominatif).
- QR code signé HMAC-SHA256, usage unique (statut « Utilisé »), vérification temps réel, scan avec résultats (valide/déjà utilisé/invalide/annulé).
- Revente encadrée (J-24h), transfert de billet (nouveau QR, ancien invalidé), invalidation admin.
- Notifications de commande/billets prêts, retry 3× en cas d'échec d'envoi.

**Reste à faire**

- Moyens de paiement alternatifs : PayPal, Apple Pay, Google Pay, Orange Money, Wave (seul Stripe est branché, les autres ne sont que des valeurs d'enum).
- Génération et envoi automatique de la facture (le champ existe, jamais rempli).
- Recalcul du reversement net après un remboursement partiel.
- PDF joint à l'email de confirmation (actuellement un simple lien, pas de pièce jointe).
- Renvoi manuel de billets par l'acheteur.
- Retry email strictement conforme (actuellement 2s/5s/10s, le CDC demande 3 tentatives espacées de 10 minutes) + alerte admin réelle en cas d'échec définitif.
- Renforcement du token QR (le CDC demande explicitement ID billet + horodatage dans le payload signé, et une vérification par recalcul cryptographique plutôt qu'un simple lookup en base).
- Alerte active (pas seulement un log) en cas de tentative de double scan.

## 4. Paiement, reversements, back-office admin

**Fait**

- Stripe Connect, solde virtuel organisateur, historique des reversements.
- Scheduler automatique de déclenchement des reversements avec vérification KYC + Stripe Connect onboardé (ajouté aujourd'hui).
- Blocage manuel de reversement, demande de reversement anticipé.
- Gestion des litiges (création, résolution, liste globale — corrigée aujourd'hui).
- File de modération des événements (valider/rejeter/suspendre), invalidation de billet, validation KYC organisateur.
- Paramétrage des taux de commission via `platform-config` (aucune valeur codée en dur).
- Journal d'audit horodaté sur toutes les actions admin sensibles.

**Reste à faire**

- Dashboard KPIs métier pour l'admin (ventes, commissions perçues, litiges ouverts) — actuellement seules des statistiques du journal d'audit sont exposées.
- Graphiques de tendance, alertes temps réel (fraude, remboursements massifs).
- Vue globale des soldes en attente de reversement (seul le blocage individuel existe).
- Export comptable (grand livre, TVA, récapitulatif commissions), export CSV/PDF du dashboard financier organisateur.
- Règle des 30 jours maximum de blocage des fonds en cas de litige (le blocage est manuel, sans limite automatique).
- Vérification du délai J+2 minimum avant une demande de reversement anticipé.
- Workflow « demande de complément d'information » côté admin pour un compte utilisateur (existe déjà pour les événements).

## 5. Notifications

**Fait**

- Confirmation de commande, billets prêts, rappel J-1 (cron quotidien), annulation d'événement, validation/rejet/suspension d'événement (organisateur), seuils de remplissage 25/50/75/100%.
- Retry 3× en cas d'échec SMTP.

**Reste à faire**

- Rappel J-1 par push (email seul actuellement).
- Notification de modification d'un événement (acheteur).
- Email de remboursement effectué (acheteur).
- Email de renvoi de billets.
- Email « première vente » (organisateur).
- Email de reversement effectué (organisateur).
- Email de litige ouvert (organisateur).

## 6. Sécurité et conformité

**Fait**

- HTTPS/Helmet, CORS, rate limiting global (IP) et par compte (login/register/forgot-password) sur la gateway.
- bcrypt coût 12, requêtes paramétrées (protection injection SQL), audit trail horodaté.
- Chiffrement IBAN AES-256-GCM, secrets externalisés (aucun mot de passe/clé en dur dans `docker-compose.yml`, tout passe par variables d'environnement).
- Préfixe `/api/v1` appliqué sur la gateway.

**Reste à faire**

- RGPD : droit à l'effacement et à la portabilité des données, politique de confidentialité, registre des traitements/DPO (hors code).
- Tests de pénétration, conformité PCI-DSS documentée (hors code, organisationnel).
- Validation des payloads sur les consommateurs RabbitMQ (`notification-service`, `pdf-service` n'ont pas de `ValidationPipe` global contrairement aux services TCP — un message malformé n'est pas rejeté proprement).

---

## 🏭 Qualité professionnelle / prêt pour la production

C'est la partie la plus importante à combler avant une mise en production réelle — aucun de ces points n'est actuellement en place :

| Sujet                                     | État            | Détail                                                                                                                                                                                                                                                                                                |
| ----------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Migrations de base de données**         | ✅ **Corrigé 2026-07-04** | Migration `InitSchema` générée pour les 7 services (DDL réel extrait via `pg_dump` du schéma dev, validé par exécution complète sur une base de test via le vrai CLI TypeORM). `migrationsRun: true` activé en production dans chaque `app.module.ts` (les migrations s'exécutent automatiquement au démarrage), `synchronize` reste réservé au dev. Scripts `migration:generate/run/revert` ajoutés à chaque `package.json` pour les évolutions futures. |
| **Tests automatisés**                     | ✅ **Corrigé 2026-07-04** | Jest n'était en réalité pas fonctionnel (package `jest` jamais installé, aucune config) — corrigé sur les 10 services. **54 tests unitaires** écrits et passants, au moins une suite par service, couvrant les points les plus sensibles : `AuthService.login` (2FA), `StockReservationService` (anti-survente + rollback), `PayoutService`/`PayoutSchedulerService` (reversements, KYC), `ScanService` (scan QR), `EventService` (commissions dynamiques), `OrganizerService` (IBAN + 2FA), `PlatformConfigService` (config dynamique), `MailService` (retry), `TicketPdfService` (échappement HTML/XSS), `RolesGuard` (contrôle d'accès). Reste à faire : tests e2e (bout-en-bout avec base de test réelle) et davantage de couverture par service. |
| **CI/CD**                                 | ✅ **Corrigé 2026-07-04** | `.github/workflows/backend-ci.yml` : matrice sur les 10 microservices, à chaque push/PR sur `main`/`develop` touchant `backend/**` — `npm ci --legacy-peer-deps`, lint (`--if-present`), `npm run build`, `npm test`. Le job lint échouait réellement en CI sur `auth-service`/`api-gateway` (`eslint` jamais installé, aucune config malgré le script déclaré) — corrigé avec ESLint 9 (flat config) + dépendances, validé en local (exit 0 sur les deux, build/tests toujours au vert). |
| **Health checks Docker**                  | ❌              | Seuls postgres/redis/rabbitmq/minio ont un `healthcheck` dans `docker-compose.yml`. Les 10 microservices + gateway démarrent sans vérification de disponibilité réelle ; `depends_on: condition: service_started` garantit seulement que le conteneur a démarré, pas que l'application NestJS écoute. |
| **Arrêt propre (graceful shutdown)**      | ❌              | Aucun service n'appelle `enableShutdownHooks()` ni ne gère `SIGTERM` — un redéploiement peut couper des requêtes/transactions en cours.                                                                                                                                                               |
| **Observabilité**                         | ❌              | Logger par défaut de NestJS uniquement, pas de logs structurés/corrélés entre microservices, pas de métriques (Prometheus/Grafana), pas d'endpoint `/health`.                                                                                                                                         |
| **Documentation API**                     | ✅              | Swagger complet sur l'API Gateway (point d'entrée public) — cohérent, les microservices internes n'ont pas besoin de leur propre doc.                                                                                                                                                                 |
| **Gestion des secrets**                   | ✅              | Toutes les valeurs sensibles passent par des variables d'environnement (`${VAR}`), rien en dur dans `docker-compose.yml`.                                                                                                                                                                             |
| **Validation des entrées (services TCP)** | ✅              | `ValidationPipe` global (`whitelist`, `transform`) sur les 8 microservices TCP + la gateway.                                                                                                                                                                                                          |
| **Vérification que les services démarrent réellement** | ✅ (corrigé 2026-07-04) | Voir la découverte critique en tête de document — plusieurs services n'avaient jamais démarré avec succès avant cette session. Sans CI ni tests, ce type de régression passe inaperçu (voir aussi la ligne CI/CD ci-dessus). |

---

## Hors périmètre de cet audit (sur demande)

- **Frontend web** (`frontend/`) : squelette `create-next-app` par défaut, aucune page métier — non détaillé ici.
- **Application mobile de contrôle d'accès** (React Native) : n'existe pas — non détaillée ici.

## Priorités suggérées pour la suite

1. **Écrire les migrations TypeORM** (ou au minimum un script d'init SQL versionné) — sans ça, aucune mise en production n'est possible.
2. **Ajouter des tests** au moins sur les flux critiques (paiement, génération/scan de billets, réservation de stock, auth).
3. **Mettre en place un pipeline CI** (lint + build + tests) même minimal.
4. Ajouter des `healthcheck` Docker sur les microservices applicatifs et un `enableShutdownHooks()` global.
5. Combler les moyens de paiement alternatifs si le CDC les exige pour le MVP (PayPal en priorité, plus simple que le mobile money).
6. Dashboard KPIs admin + exports comptables (valeur business élevée pour la soutenance/démo).
7. Volet RGPD (droit à l'effacement, politique de confidentialité) — nécessaire même en version académique si des données réelles sont utilisées.
