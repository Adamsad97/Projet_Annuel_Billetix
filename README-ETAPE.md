# BilletiX — Backend, suivi CDC

Périmètre : backend uniquement (10 microservices + API Gateway). Front web et app mobile hors périmètre.

## Fait récemment (2026-07-07)

- Facture PDF automatique après paiement (en-tête légal configurable, HT/TVA/TTC)
- Dashboard organisateur temps réel (`GET /events/me/dashboard`, `GET /events/:id/dashboard`, push WebSocket)
- Dashboard KPIs admin (`GET /admin/dashboard` : revenu, tendance, litiges, reversements) avec alertes temps réel (remboursements massifs, pic de litiges)
- Sécurité QR code durcie : token signé HMAC-SHA256 (ID billet + horodatage), vérification par recalcul cryptographique. Corrige au passage une faille critique (le code lisait `QR_SECRET`, jamais défini, au lieu de `QR_HMAC_SECRET` — tous les QR étaient signés avec un secret par défaut codé en dur)

## Reste à faire (par ordre d'importance)

- Recherche/liste globale utilisateurs admin, suppression de compte (RGPD)
- RGPD complet (portabilité, politique de confidentialité, cookies, DPO)
- Recalcul du reversement après remboursement partiel
- Validation des payloads RabbitMQ (notification-service, pdf-service)
- PDF joint à l'email (actuellement un lien), retry conforme 10 min, alerte admin réelle
- Workflow "demande de complément d'info" pour un compte utilisateur
- Délai réglementaire 48h + transition auto TERMINATED/ARCHIVED
- Notifications manquantes (rappel J-1 push, remboursement, litige ouvert, première vente, reversement effectué)
- Description riche (WYSIWYG), carte interactive/géocodage
- Recherche par mots-clés et filtres avancés (prix, distance)
- Modification/report d'événement post-publication, événements récurrents
- Export comptable (grand livre, TVA, CSV/PDF)
- Moyens de paiement alternatifs (PayPal, Apple Pay, Google Pay, mobile money)
- Application mobile de contrôle (React Native) — n'existe pas
- Observabilité avancée (logs structurés, métriques), tests e2e, pentest/PCI-DSS documenté
