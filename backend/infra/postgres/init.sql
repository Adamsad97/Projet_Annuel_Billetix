-- ══════════════════════════════════════════════════════════════════
-- BilletiX — Initialisation PostgreSQL
-- Création des schemas par domaine métier (un schema par service)
-- ══════════════════════════════════════════════════════════════════

-- Schemas métier
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS users;
CREATE SCHEMA IF NOT EXISTS events;
CREATE SCHEMA IF NOT EXISTS orders;
CREATE SCHEMA IF NOT EXISTS tickets;
CREATE SCHEMA IF NOT EXISTS payments;
CREATE SCHEMA IF NOT EXISTS admin_logs;

-- Extension UUID (utilisée par tous les services)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Extension pour les recherches full-text (catalogue événements)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Extension PostGIS optionnelle pour la géolocalisation
-- CREATE EXTENSION IF NOT EXISTS postgis;
