FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
# npm ci : installe exactement le lockfile, plus rapide que npm install.
# Cache npm partagé entre builds (BuildKit) : pas de re-téléchargement.
RUN --mount=type=cache,target=/root/.npm npm ci --legacy-peer-deps

FROM base AS development
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM base AS builder
# Les NEXT_PUBLIC_* sont figées dans le bundle navigateur au moment du
# build : sans ces ARG, clé Stripe et URL d'API seraient undefined côté
# client (les passer seulement au runtime, via environment:, ne suffit pas).
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
COPY . .
RUN npm run build

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
# Next.js standalone mode
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
