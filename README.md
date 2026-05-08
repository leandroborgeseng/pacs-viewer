# MedView — Portal médico (OHIF v3 + NestJS + Next.js)

Monorepo **self-hosted**: frontend em **Next.js 15** (Tailwind, shadcn/ui), backend em **NestJS** com **Prisma/PostgreSQL**, autenticação **JWT** e **RBAC** (ADMIN, MEDICO, PACIENTE). O **Orthanc** expõe DICOMweb apenas ao backend; o browser fala com o **proxy** `/api/dicomweb`, nunca diretamente com o PACS.

## Perfis e regras

| Perfil   | Exames                         | OHIF                         |
|----------|--------------------------------|------------------------------|
| PACIENTE | Só estudos do próprio paciente | URL com `#patient` (config)  |
| MEDICO   | Estudos com permissão explícita| Ferramentas completas        |
| ADMIN    | Todos (catálogo portal)        | Ferramentas completas        |

**Paciente**: sem export DICOM no produto final — restringir via configuração OHIF/extensões e política clínica. **Médico**: vínculo na tabela `permissions`.

## Estrutura

- `api/` — NestJS, Prisma, proxy DICOMweb, auditoria básica.
- `web/` — Next.js 15, login, dashboard, exames, viewer iframe; **OHIF v3.8.3** compilado no Docker e servido em **`/ohif`**.  
- `web/scripts/write-ohif-app-config.mjs` — gera `public/ohif/app-config.js` com a URL pública da API (`…/api/dicomweb`).  
- `web/ohif-version` — tag Git do OHIF usada no build Docker.  
- `infra/ohif/app-config.js` — apenas referência legada (contentor separado); não é necessário no fluxo integrado.
- `docker-compose.yml` — Postgres, Orthanc, API, Web *(OHIF já incluído na imagem Web)*.

## OHIF integrado (Docker / Railway)

O `web/Dockerfile` tem duas fases:

1. **ohif-builder** — clone superficial do repositório [OHIF/Viewers](https://github.com/OHIF/Viewers) (tag em `web/ohif-version`, atualmente **v3.8.3**), `yarn install`, `yarn build` com `PUBLIC_URL=/ohif/` para todos os chunks sob `/ohif/...`.  
2. **Next.js** — copia `platform/app/dist` → `public/ohif`, corre `write-ohif-app-config.mjs` (usa `NEXT_PUBLIC_API_URL`) e faz `next build`.

O iframe do portal usa o caminho **`NEXT_PUBLIC_OHIF_BASE_PATH`** (predefinição `/ohif`), ou seja, o mesmo domínio que o portal — menos CORS e um único deploy no Railway para UI + viewer.

**Railway (serviço Web)** — defina variáveis de **build** (e runtime se precisar de re-deploy):

- `NEXT_PUBLIC_API_URL` = URL HTTPS pública da API **com** `/api` no fim (ex.: `https://api-seuprojecto.up.railway.app/api`).  
- `NEXT_PUBLIC_OHIF_BASE_PATH` = `/ohif` (normalmente não precisa de mudar).

Na **API**, `WEB_ORIGIN` deve ser a origem exata do frontend (ex.: `https://web-seuprojecto.up.railway.app`).

> O build do OHIF é pesado (memória ~6 GB, vários minutos). Se o build falhar por OOM, aumente o tamanho do builder no Railway ou compile localmente e use cache de imagem.

**Desenvolvimento só com `npm run dev`:** não inclui o OHIF. Para testar o viewer localmente, use `docker compose up --build web` ou construa a imagem `web` para popular `public/ohif`.

## Requisitos locais

- Node 22+ (ou usar apenas Docker).
- Docker Desktop (opcional, recomendado).

## Variáveis de ambiente

Copie os exemplos:

```bash
cp api/.env.example api/.env
cp web/.env.example web/.env.local
```

Ajuste `ORTHANC_DICOMWEB_ROOT` para o endpoint **DICOMweb** do Orthanc (ex.: `https://orthanc.hospital/dicom-web` ou serviço remoto atrás de VPN). Credenciais Basic opcionais: `ORTHANC_USERNAME` / `ORTHANC_PASSWORD`.

**Web (browser)**  
- `NEXT_PUBLIC_API_URL` — URL pública da API com `/api` (ex.: `https://api.seudominio.com/api`).  
- `NEXT_PUBLIC_OHIF_BASE_PATH` — caminho onde o OHIF estático é servido pelo Next (predefinição `/ohif`).  
- `MEDVIEW_API_BASE` *(opcional)* — sobrescreve só a base usada em `write-ohif-app-config.mjs` (útil se difere de `NEXT_PUBLIC_API_URL`).

O ficheiro `public/ohif/app-config.js` é **gerado no build Docker** (ou manualmente com `npm run ohif:config` depois de existir `public/ohif` a partir da compilação OHIF).

## Desenvolvimento (sem Docker)

1. **PostgreSQL** a correr e `DATABASE_URL` válido.  
2. API:

```bash
cd api
npm install
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```

3. Web:

```bash
cd web
npm install
npm run dev
```

Abra `http://localhost:3000`. Contas de seed (altere em produção):

- `admin@portal.local` / `Admin123!`
- `medico@portal.local` / `Medico123!`
- `paciente@portal.local` / `Paciente123!`

Defina `SEED_STUDY_INSTANCE_UID` no `.env` da API para coincidir com um estudo real no Orthanc.

> O separador **Exames / OHIF** em `/viewer` só funciona se existir uma pasta `web/public/ohif` (por exemplo após `docker compose build web`). O resto do portal funciona normalmente.

## Docker Compose

```bash
docker compose up --build
```

- Portal + **OHIF integrado**: `http://localhost:3000` (viewer em `http://localhost:3000/ohif/...`)  
- API: `http://localhost:3001/api`  
- Orthanc: `http://localhost:8042`

Após o primeiro arranque, execute o seed **uma vez**:

```bash
docker compose exec api npx prisma db seed
```

## Integração OHIF ↔ JWT

O iframe abre `/ohif/viewer?StudyInstanceUIDs=…&access_token=…`. O `app-config.js` gerado no build envia `Authorization: Bearer` em cada pedido ao proxy. O Nest aceita JWT no **header** ou na query `access_token`.

Para **Orthanc remoto**, configure apenas `ORTHANC_DICOMWEB_ROOT` na API; o browser continua a contactar só o Nest.

## Railway

**Ligar PostgreSQL no Railway**

1. No projeto, **Add → Database → PostgreSQL**.  
2. No serviço **API** → **Variables** → **Add variable Reference** → escolha o Postgres e o campo **`DATABASE_URL`** (ou copie a URL do separador Variables do Postgres).  
3. Sem `DATABASE_URL`, o `prisma migrate` na arranque falha com **P1012** (como nos teus logs).

**API — variáveis obrigatórias** (sem isto o processo morre antes do `/health`):

- `DATABASE_URL` — ligar o plugin **PostgreSQL** ao serviço e usar a URL que o Railway gera (referência ` ${{ Postgres.DATABASE_URL }}` ou copiar do plugin).
- `JWT_SECRET` — string longa e aleatória (ex. 32+ caracteres). Sem isto, o arranque falha em ciclo com `[bootstrap] … JWT_SECRET` nos Deploy Logs.
- `WEB_ORIGIN` — URL pública do frontend (pode ser o domínio `*.up.railway.app` do serviço Web).
- `PORT` — normalmente injetado pelo Railway; não apagar.

Se o healthcheck falhar, abra **Deploy Logs**: mensagens como `Variável obrigatória em falta` ou erros de `prisma migrate` / `P1001` indicam base ou rede.

1. Serviços recomendados: **PostgreSQL**, **API** (`api/Dockerfile`), **Web** (`web/Dockerfile`). Já **não** é necessário um serviço OHIF à parte.  
2. Na API: `DATABASE_URL`, `JWT_SECRET`, `WEB_ORIGIN` (URL exata do frontend), `ORTHANC_DICOMWEB_ROOT`, e credenciais Orthanc se necessário.  
3. Na Web — variáveis de **build**: `NEXT_PUBLIC_API_URL` (URL HTTPS da API + `/api`), `NEXT_PUBLIC_OHIF_BASE_PATH=/ohif`. A imagem final usa Next **standalone**; o arranque é `node server.js` (ver `web/railway.json` — não use `npm run start` no deploy).  
4. O **contexto de build** é sempre a **raiz do Git**; os Dockerfiles usam os prefixos `api/` e `web/`. Não defina “Root Directory” só para `api` a menos que duplique esta lógica.  
5. `railway.json` na raiz é orientado à API; o ficheiro `web/railway.json` assume **raiz do Git** como contexto de build e `dockerfilePath: web/Dockerfile`. Se no serviço Web definires **Root Directory** = `web`, altera o path do Dockerfile para `Dockerfile`.

Em produção use HTTPS; o `app-config.js` incorpora a URL da API definida no momento do build.

**502 no domínio público do serviço Web** — o proxy do Railway encaminha para **a mesma porta em que o Node está a ouvir** (`process.env.PORT` injetado pelo Railway). Se no **Networking** definires manualmente **“porta 3000”** mas o Railway tiver definido `PORT` para outro valor (ex. `8080`), nada ouve na 3000 e aparece **502**. **Correção:** no serviço **Web** → **Networking**, remove a porta personalizada e volta a **gerar o domínio** (configuração por defeito), *ou* define **Target port = `$PORT`** / o valor que Railway mostra nas docs, *ou* garante explicitamente nas **Variables** `PORT=3000` **e** target 3000 — mas o mais simples é **não forçar 3000** e deixar o Railway alinhar com `PORT`. Confirma nos **Deploy Logs** que `node server.js` arrancou sem erro.

## Endpoints REST principais (prefixo `/api`)

- `POST /api/auth/login` — JWT.  
- `GET /api/auth/me` — utilizador atual.  
- `GET /api/studies/me` — estudos visíveis ao perfil.  
- `GET|POST|… /api/dicomweb/*` — proxy para Orthanc (autenticado).  
- Admin: `GET /api/users`, `POST /api/users`, `GET /api/patients`, `POST /api/patients`, `GET /api/studies`, `POST /api/studies`, `GET|POST|DELETE /api/permissions`, etc.

Auditoria: interceptor em mutações (exceto login e tráfego DICOMweb).

## Segurança (MVP)

- JWT em `localStorage` no browser é aceitável para MVP interno; evolua para **HttpOnly cookies** + **BFF** se necessário.  
- Token na query do OHIF pode aparecer em logs de proxies — minimize retention e use HTTPS.  
- Rate limit global (`ThrottlerModule`) aplicado à API.

## Licença

Código de exemplo para integração clínica — ajuste conforme compliance (HIPAA, RGPD, CFM, etc.).
