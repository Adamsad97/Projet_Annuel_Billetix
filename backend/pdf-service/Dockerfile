# Puppeteer nécessite Chromium — image Debian au lieu d'Alpine
FROM node:22-slim AS base
WORKDIR /app
# Dépendances système pour Chromium
RUN apt-get update && apt-get install -y \
  chromium \
  fonts-freefont-ttf \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
COPY package*.json ./
RUN npm install --legacy-peer-deps

FROM base AS development
COPY . .
CMD ["npm", "run", "start:dev"]

FROM base AS builder
COPY . .
RUN npm run build

FROM node:22-slim AS production
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y \
  chromium \
  fonts-freefont-ttf \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
EXPOSE 3008
CMD ["node", "dist/main"]
