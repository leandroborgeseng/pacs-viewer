# Build a partir da RAIZ do monorepo:
#   docker build -f web/Dockerfile .

# --- OHIF Viewer v3 ---
FROM node:18-bookworm-slim AS ohif-builder
ARG OHIF_VERSION=v3.8.3
RUN apt-get update \
  && apt-get install -y --no-install-recommends git python3 build-essential ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /usr/src
RUN git clone --depth 1 --branch "${OHIF_VERSION}" https://github.com/OHIF/Viewers.git app
WORKDIR /usr/src/app
# Ativa mais extensões/modos OHIF compilados localmente (SR, SEG, PDF, vídeo, RT, tracking, volumes).
COPY web/ohif-patches/pluginConfig.json ./platform/app/pluginConfig.json
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare yarn@1.22.22 --activate
ENV NODE_OPTIONS=--max_old_space_size=6144
ENV QUICK_BUILD=true
ENV PUBLIC_URL=/ohif/
# Não definir NODE_ENV=production antes do yarn install: o Yarn omitiria
# devDependencies e o build do OHIF falha com "lerna: not found".
RUN yarn install --network-timeout 300000 \
  && NODE_ENV=production yarn run build

# --- Next.js deps ---
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY web/package.json web/package-lock.json* ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY web/ .
COPY --from=ohif-builder /usr/src/app/platform/app/dist ./public/ohif
ARG NEXT_PUBLIC_API_URL=http://127.0.0.1:3001/api
ARG NEXT_PUBLIC_OHIF_BASE_PATH=/ohif
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_OHIF_BASE_PATH=${NEXT_PUBLIC_OHIF_BASE_PATH}
RUN node scripts/write-ohif-app-config.mjs \
  && node scripts/inject-ohif-assets.mjs \
  && npm run build

# --- Next.js standalone ---
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# Next standalone usa process.env.PORT (Railway injeta isto; raramente é 3000).
# Não forces no painel do Railway "porta interna 3000" sem bater certo com o PORT do contentor.
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static

COPY web/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

USER nextjs
EXPOSE 3000
# sh explícito: evita falhas se o bit +x ou o shebang não forem respeitados no runtime.
CMD ["/bin/sh", "/docker-entrypoint.sh"]
