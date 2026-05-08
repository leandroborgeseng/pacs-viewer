# Build a partir da RAIZ do repositório (Railway, CI):
#   docker build -f api/Dockerfile .
#
# Railway: adicione DATABASE_URL (referência ao plugin PostgreSQL) + JWT_SECRET nas Variables.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY api/package.json api/package-lock.json* ./
RUN npm ci

FROM node:22-bookworm-slim AS build
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY api/ .
RUN npx prisma generate
RUN npm run build

FROM node:22-bookworm-slim AS runner
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY api/package.json api/package-lock.json* ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY api/prisma ./prisma
EXPOSE 3000
CMD ["sh", "-c", "if [ -z \"${DATABASE_URL}\" ]; then echo 'ERRO: DATABASE_URL não definida. No Railway: crie o plugin PostgreSQL e adicione a variável DATABASE_URL (referência ao URL da base deste projeto).' >&2; exit 1; fi; npx prisma migrate deploy && npx prisma db seed && exec node dist/main.js"]
