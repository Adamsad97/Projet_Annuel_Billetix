✅ Fait depuis le 2026-07-07 : facture automatique (2.4/4.3), tableau de bord organisateur temps réel (2.5), **dashboard KPIs admin** (8.1 : `GET /admin/dashboard` — revenu plateforme, tendance 30 jours, litiges ouverts, solde reversements, répartition événements/utilisateurs — avec alertes temps réel "remboursements massifs"/"pic de litiges" configurables via `platform-config`, poussées en direct aux admins connectés via WebSocket. Validé par test réel : seuil franchi → alerte reçue en moins d'une seconde par un client connecté), et **durcissement sécurité du QR code** (5.3).

**Détail sécurité QR (2026-07-07)** — deux failles réelles corrigées :
1. **Faille critique découverte en cours de route** : le code lisait la variable d'env `QR_SECRET`, qui n'a jamais existé — `docker-compose`/`.env` fournissent `QR_HMAC_SECRET`. Résultat : **tous les QR codes générés depuis toujours étaient en réalité signés avec le secret de repli codé en dur `'default_secret'`**, visible dans le code source, pas le vrai secret configuré. Corrigé (plus aucun secret de repli, comme pour `JWT_ACCESS_SECRET`).
2. **Token QR refondu** conformément au CDC : payload `ticket_id:horodatage` (base64url) + signature HMAC-SHA256 du payload, au lieu d'un digest opaque non rejouable. `verifyQr()` recalcule et compare la signature en temps constant (`timingSafeEqual`, anti timing-attack) au lieu d'un simple lookup en base par token brut.
3. **Bug corrigé au passage** : en cas de double scan, le code retrouvait le ticket concerné via "le dernier log de scan de l'événement" (pouvait désigner le mauvais billet si un autre agent scannait en même temps) — corrigé, le ticket_id est désormais extrait directement et fiablement du payload signé.
4. **Alerte active en cas de double scan** — poussée en temps réel aux admins connectés (WebSocket), pas seulement journalisée.

Validé par test réel complet : génération d'un vrai billet → scan valide (SUCCESS) → re-scan (ALREADY_USED, bon ticket_id + alerte WS reçue) → token falsifié (signature altérée) correctement rejeté (INVALID).

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
│ 9 │ 6 │ Application mobile de contrôle (React Native) — n'existe pas │
├─────┼─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 10 │ 6.2-6.7 │ Compteurs temps réel, saisie manuelle billet, supervision salle, confort app mobile │
├─────┼─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 11 │ 8.4 │ Export comptable (grand livre, TVA, CSV/PDF) — la vue globale des soldes en attente est désormais dans le dashboard admin │
├─────┼─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 12 │ 8.2 │ Workflow « demande de complément d'info » pour un compte utilisateur │
├─────┼─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 13 │ 9.1-9.2 │ Rappel J-1 push, notif modification événement, remboursement/renvoi billets, première vente, reversement effectué, litige ouvert │
├─────┼─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 14 │ 10.4 │ RGPD (effacement/portabilité, politique confidentialité, cookies, DPO) │
├─────┼─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 15 │ 10.3 │ Tests de pénétration/PCI-DSS documentés, validation payloads RabbitMQ (notification/pdf-service) │
├─────┼─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 16 │ — │ Observabilité avancée (logs structurés JSON, corrélation, métriques Prometheus/Grafana) │
├─────┼─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 17 │ — │ Tests e2e (seuls des tests unitaires existent) │
└─────┴─────────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
