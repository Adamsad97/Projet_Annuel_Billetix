-- ══════════════════════════════════════════════════════════════════
-- BilletiX — Base dédiée event-service
-- ══════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- Recherches full-text (catalogue événements)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- Extension PostGIS optionnelle pour la géolocalisation
-- CREATE EXTENSION IF NOT EXISTS postgis;
CREATE SCHEMA IF NOT EXISTS events;
