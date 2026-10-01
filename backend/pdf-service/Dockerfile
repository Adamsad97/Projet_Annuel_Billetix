# Puppeteer nécessite Chromium — image Debian (Chromium Alpine plus lourd :
# il embarque LLVM/Mesa)
FROM node:22-slim AS base
WORKDIR /app
# Chromium système plutôt que le Chrome de Puppeteer (PUPPETEER_SKIP_DOWNLOAD évite ~300 Mo par npm ci).
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY package*.json ./
# npm ci : installe exactement le lockfile, plus rapide que npm install.
# Cache npm partagé entre builds (BuildKit) : pas de re-téléchargement.
RUN --mount=type=cache,target=/root/.npm npm ci --legacy-peer-deps

FROM base AS builder
COPY . .
# Élague les devDependencies ici plutôt que de refaire une installation
# complète dans l'étape production.
RUN npm run build && npm prune --omit=dev --legacy-peer-deps

# chromium-headless-shell suffit pour page.pdf() ; fonts-liberation remplace Arial dans les gabarits.
FROM node:22-slim AS runtime-base
RUN apt-get update && apt-get install -y --no-install-recommends \
  chromium-headless-shell \
  fonts-liberation \
  && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-headless-shell

FROM runtime-base AS development
WORKDIR /app
COPY --from=base /app/node_modules ./node_modules
COPY . .
CMD ["npm", "run", "start:dev"]

FROM runtime-base AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
EXPOSE 3008
CMD ["node", "dist/main"]
