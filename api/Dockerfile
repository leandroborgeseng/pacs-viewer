# Build a partir da RAIZ do repositório (Railway, CI):
#   docker build -f api/Dockerfile .
#
# Contexto = monorepo; todos os COPY usam o prefixo api/

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY api/package.json api/package-lock.json* ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY api/ .
RUN npx prisma generate
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY api/package.json api/package-lock.json* ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY api/prisma ./prisma
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
