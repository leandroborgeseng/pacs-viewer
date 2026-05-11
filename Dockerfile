# API NestJS — contexto de build = RAIZ do monorepo.
#   docker build .
#
# O Metal/Railway Railpack ignora Dockerfiles só em subpastas; este arquivo
# na raiz permite detecção automática. Serviço Web: use web/Dockerfile no painel.

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
CMD ["sh", "-c", "if [ -z \"${DATABASE_URL}\" ]; then echo 'ERRO: DATABASE_URL não definida. No Railway: crie o plugin PostgreSQL e adicione a variável DATABASE_URL (referência ao URL do banco deste projeto).' >&2; exit 1; fi; npx prisma migrate deploy || exit 1; case \"${SKIP_DB_SEED}\" in 1|true|TRUE|yes|YES) echo '[bootstrap] SKIP_DB_SEED ativo — prisma db seed omitido.';; *) echo '[bootstrap] Executando prisma db seed (demo). Defina SKIP_DB_SEED=1 em produção real.'; npx prisma db seed || exit 1;; esac; exec node dist/main.js"]
