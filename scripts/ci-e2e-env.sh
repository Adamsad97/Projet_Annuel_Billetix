#!/usr/bin/env bash
# Prépare le .env des tests fonctionnels en CI : secrets aléatoires propres à l'exécution, emails capturés par Mailpit.
set -euo pipefail

hex() { openssl rand -hex "$1"; }
set_var() {
  if grep -q "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else echo "$1=$2" >> .env; fi
}

cp .env.example .env
set_var COMPOSE_FILE docker-compose.yml
set_var POSTGRES_PASSWORD "$(hex 16)"
set_var REDIS_PASSWORD "$(hex 16)"
set_var RABBITMQ_PASSWORD "$(hex 16)"
set_var MINIO_ROOT_PASSWORD "$(hex 16)"
set_var JWT_ACCESS_SECRET "$(hex 32)"
set_var JWT_REFRESH_SECRET "$(hex 32)"
set_var IBAN_ENCRYPTION_KEY "$(hex 32)"
set_var QR_SIGNING_PRIVATE_KEY "$(openssl genpkey -algorithm ed25519 -outform DER | base64 -w0)"
set_var BOOTSTRAP_ADMIN_EMAIL "$E2E_ADMIN_EMAIL"
set_var BOOTSTRAP_ADMIN_PASSWORD "$E2E_ADMIN_PASSWORD"
set_var SMTP_HOST mailpit
set_var SMTP_PORT 1025
set_var SMTP_USER ""
set_var SMTP_PASS ""
# Clé Stripe de test facultative (secret du dépôt) : sans elle, le parcours de paiement est ignoré par les tests.
if [ -n "${E2E_STRIPE_SECRET_KEY:-}" ]; then set_var STRIPE_SECRET_KEY "$E2E_STRIPE_SECRET_KEY"; fi
