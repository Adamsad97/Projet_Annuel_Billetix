FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
# npm ci : installe exactement le lockfile, plus rapide que npm install.
# Cache npm partagé entre builds (BuildKit) : pas de re-téléchargement.
RUN --mount=type=cache,target=/root/.npm npm ci --legacy-peer-deps

FROM base AS development
COPY . .
CMD ["npm", "run", "start:dev"]

FROM base AS builder
COPY . .
# Élague les devDependencies ici plutôt que de refaire une installation
# complète dans l'étape production.
RUN npm run build && npm prune --omit=dev --legacy-peer-deps

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
EXPOSE 3001
CMD ["node", "dist/main"]
