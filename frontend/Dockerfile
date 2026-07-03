FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps

FROM base AS development
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM base AS builder
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
