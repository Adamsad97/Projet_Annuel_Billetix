✅ Fait depuis le 2026-07-07 : facture automatique (2.4/4.3), tableau de bord organisateur temps réel (2.5), et **dashboard KPIs admin** (8.1 : `GET /admin/dashboard` — revenu plateforme, tendance 30 jours, litiges ouverts, solde reversements, répartition événements/utilisateurs — avec alertes temps réel "remboursements massifs"/"pic de litiges" configurables via `platform-config`, poussées en direct aux admins connectés via WebSocket. Validé par test réel : seuil franchi → alerte reçue en moins d'une seconde par un client connecté).

❌ TABLEAU 2 — CE QUI N'EST PAS FAIT

┌─────┬─────────────┬──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ # │ Section CDC │ Élément manquant ou incomplet │
├─────┼─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 1 │ 8.3 │ Recherche/liste globale utilisateurs (admin), suppression de compte (RGPD) │
├─────┼─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 2 │ 3.1 │ Description riche (WYSIWYG), carte interactive/géocodage │
├─────┼─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 3 │ 3.3 │ Délai réglementaire 48h ouvrées, transition auto TERMINATED/ARCHIVED │
├─────┼─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 4 │ 3.4 │ Recherche par mots-clés, filtres avancés (prix, distance) │
├─────┼─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 5 │ 3.1 │ Modification/report d'événement post-publication, événements récurrents │
├─────┼─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 6 │ 4.2 │ Moyens de paiement alternatifs (PayPal, Apple Pay, Google Pay, mobile money) │
├─────┼─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 7 │ 7.2 │ Recalcul reversement après remboursement partiel, règle 30j litige, délai J+2 │
├─────┼─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 8 │ 5.2 │ PDF joint à l'email, retry conforme 10 min, alerte admin réelle │
├─────┼─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 9 │ 5.3 │ Renforcement token QR (horodatage + recalcul crypto), alerte active double scan │
├─────┼─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 10 │ 6 │ Application mobile de contrôle (React Native) — n'existe pas │
├─────┼─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 11 │ 6.2-6.7 │ Compteurs temps réel, saisie manuelle billet, supervision salle, confort app mobile │
├─────┼─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 12 │ 8.4 │ Export comptable (grand livre, TVA, CSV/PDF) — la vue globale des soldes en attente est désormais dans le dashboard admin │
├─────┼─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 13 │ 8.2 │ Workflow « demande de complément d'info » pour un compte utilisateur │
├─────┼─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 14 │ 9.1-9.2 │ Rappel J-1 push, notif modification événement, remboursement/renvoi billets, première vente, reversement effectué, litige ouvert │
├─────┼─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 15 │ 10.4 │ RGPD (effacement/portabilité, politique confidentialité, cookies, DPO) │
├─────┼─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 16 │ 10.3 │ Tests de pénétration/PCI-DSS documentés, validation payloads RabbitMQ (notification/pdf-service) │
├─────┼─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 17 │ — │ Observabilité avancée (logs structurés JSON, corrélation, métriques Prometheus/Grafana) │
├─────┼─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 18 │ — │ Tests e2e (seuls des tests unitaires existent) │
└─────┴─────────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
