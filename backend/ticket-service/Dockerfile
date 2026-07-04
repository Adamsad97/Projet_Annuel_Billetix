FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps

FROM base AS development
COPY . .
CMD ["npm", "run", "start:dev"]

FROM base AS builder
COPY . .
RUN npm run build

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps && npm cache clean --force
COPY --from=builder /app/dist ./dist
EXPOSE 3005
CMD ["node", "dist/main"]
