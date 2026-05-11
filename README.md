# BlueBeaver — Portal médico (OHIF v3 + NestJS + Next.js)

Monorepo **self-hosted**: frontend em **Next.js 15** (Tailwind, shadcn/ui), backend em **NestJS** com **Prisma/PostgreSQL**, autenticação **JWT** e **RBAC** (ADMIN, MEDICO, PACIENTE). O **Orthanc** expõe DICOMweb apenas ao backend; o navegador fala com o **proxy** `/api/dicomweb`, nunca diretamente com o PACS. O viewer OHIF usa tema **BlueBeaver** (CSS/bridge inject no build), tipografia Montserrat **local** em `/ohif/fonts/` e **CSP** aplicada ao portal em produção.

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
- `web/scripts/write-ohif-app-config.mjs` — gera `public/ohif/app-config.js`: o OHIF usa **mesma origem** que o portal (`…/bb-api/dicomweb`), e o Next encaminha para `NEXT_PUBLIC_API_URL/dicomweb` (evita CORS/CSP no viewer).  
- `web/scripts/inject-ohif-assets.mjs` — copia fontes Montserrat para `public/ohif/fonts/`, injeta `bluebeaver-ohif.css` + `bluebeaver-iframe-bridge.js` no `index.html`, `lang`/título institucional, e bootstrap **pt-BR** (`lng` na URL + cache i18next) antes dos bundles OHIF.
- `web/ohif-patches/pluginConfig.json` — opcional aplicado na fase Docker do OHIF: ativa mais extensões compiladas (`SEG`, `SR`, `PDF`, vídeo, `RT`, métricas, volumes). Microscopia, TMTV e modos pré-clínicos permanecem desativados neste arquivo para limitar tempo/tamanho de build — você pode alterá-lo e reconstruir a imagem.
- `web/ohif-version` — tag Git do OHIF usada no build Docker.  
- `infra/ohif/app-config.js` — apenas referência legada (contêiner OHIF separado); não é necessário no fluxo integrado.
- `docker-compose.yml` — Postgres, Orthanc, API, Web *(OHIF já incluído na imagem Web)*.

## OHIF integrado (Docker / Railway)

O `web/Dockerfile` tem duas fases:

1. **ohif-builder** — clone superficial do repositório [OHIF/Viewers](https://github.com/OHIF/Viewers) (tag em `web/ohif-version`, atualmente **v3.8.3**); copia-se `web/ohif-patches/pluginConfig.json` para `platform/app/pluginConfig.json` do clone; segue-se `yarn install` e `yarn build` com `PUBLIC_URL=/ohif/` para os chunks sob `/ohif/...`.  
2. **Next.js** — copia `platform/app/dist` → `public/ohif`, executa `write-ohif-app-config.mjs` (usa `NEXT_PUBLIC_API_URL`) e faz `next build`.

O iframe do portal usa o caminho **`NEXT_PUBLIC_OHIF_BASE_PATH`** (padrão `/ohif`), ou seja, o mesmo domínio que o portal — menos CORS e um único deploy no Railway para UI + viewer.

**Railway (serviço Web)** — defina variáveis de **build** (e runtime se precisar de re-deploy):

- `NEXT_PUBLIC_API_URL` = URL HTTPS pública da API **com** `/api` no fim (ex.: `https://api-seuprojeto.up.railway.app/api`).  
- `NEXT_PUBLIC_OHIF_BASE_PATH` = `/ohif` (normalmente não precisa mudar).

Na **API**, `WEB_ORIGIN` deve ser a origem exata do frontend (ex.: `https://web-seuprojeto.up.railway.app`).

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

**Web (navegador)**  
- `NEXT_PUBLIC_API_URL` — URL pública da API com `/api` (ex.: `https://api.seudominio.com/api`).  
- `NEXT_PUBLIC_OHIF_BASE_PATH` — caminho onde o OHIF estático é servido pelo Next (padrão `/ohif`).  
- `MEDVIEW_API_BASE` *(opcional)* — sobrescreve só a base usada em `write-ohif-app-config.mjs` (útil se difere de `NEXT_PUBLIC_API_URL`).

O arquivo `public/ohif/app-config.js` é **gerado no build Docker** (ou manualmente com `npm run ohif:config` depois de existir `public/ohif` a partir da compilação OHIF).

## Desenvolvimento (sem Docker)

1. **PostgreSQL** em execução e `DATABASE_URL` válido.  
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

> A aba **Exames / OHIF** em `/viewer` só funciona se existir uma pasta `web/public/ohif` (por exemplo após `docker compose build web`). O resto do portal funciona normalmente.

### Testes E2E (Playwright)

Com a stack completa no ar (`docker compose up --build` na raiz), na pasta `web/`:

```bash
npm install
npx playwright install chromium
npm run test:e2e
```

O cenário `e2e/portal-ohif.spec.ts` cobre **login → exames → nova janela OHIF** e espera um pedido **GET/HEAD** ao proxy **`/api/dicomweb/`** com código HTTP inferior a 500. Variável opcional: `PLAYWRIGHT_BASE_URL` (por padrão `http://localhost:3000`).  
Para imagens reais no viewer, carregue no **Orthanc** um estudo cujo UID coincida com o seed (ou defina `SEED_STUDY_INSTANCE_UID`).

## Docker Compose

```bash
docker compose up --build
```

- Portal + **OHIF integrado**: `http://localhost:3000` (viewer em `http://localhost:3000/ohif/...`)  
- PACS: o compose está configurado para **DICOMweb remoto** (`ORTHANC_DICOMWEB_ROOT` no `docker-compose.yml` — ajuste antes de produção).  
- API: `http://localhost:3001/api`  
- **Orthanc local (opcional):** `docker compose --profile local-pacs up --build` inclui o serviço em `http://localhost:8042` para desenvolvimento sem PACS remoto.

O **seed** (`prisma/seed.js`) executa **automaticamente** após `prisma migrate deploy` em cada inicialização da API (Dockerfile / Railway). Nos três e-mails de demo, o `upsert` **atualiza** `passwordHash` e `active` — útil se o banco já tinha usuários com senha errada; em produção real mude as senhas ou remova o seed automático.

## Integração OHIF ↔ JWT

O iframe abre `/ohif/viewer?StudyInstanceUIDs=…&access_token=…`. O OHIF faz QIDO/WADO para **`{origem-do-portal}/bb-api/dicomweb`** (proxy no **Next** → `/api/dicomweb` na API). O Nest aceita JWT no **header** ou na query `access_token`.

Para **Orthanc remoto**, configure apenas `ORTHANC_DICOMWEB_ROOT` na API; o navegador só se comunica com o Nest.

**Lista em Exames (`GET /api/studies/me`):** os metadados vêm do **PACS** (QIDO `GET …/dicom-web/studies`). **ADMIN** vê todos os estudos devolvidos pelo Orthanc. **MEDICO** e **PACIENTE** só veem estudos cujo `StudyInstanceUID` está autorizado no banco (permissões / paciente); é necessário existir registro `Study` com o mesmo UID no portal para amarrar permissões (o catálogo continua sendo filtrado a partir dos dados do PACS).

**URLs nos metadados (WADO / thumbnails):** o Orthanc devolve frequentemente links absolutos (`http://pacs:8042/dicom-web/…`). O proxy da API reescreve-os para `{WEB_ORIGIN}/bb-api/dicomweb/…` em respostas JSON, para o navegador usar o mesmo proxy que o QIDO — **defina `WEB_ORIGIN` com o URL público exato do portal** (ex. `https://seu-app.up.railway.app`, sem barra no fim).

## Railway

**Conectar PostgreSQL no Railway**

1. No projeto, **Add → Database → PostgreSQL**.  
2. No serviço **API** → **Variables** → **Add variable Reference** → escolha o Postgres e o campo **`DATABASE_URL`** (ou copie a URL da aba Variables do Postgres).  
3. Sem `DATABASE_URL`, o `prisma migrate` na inicialização falha com **P1012** (como nos seus logs).

**API — variáveis obrigatórias** (sem isto o processo morre antes do `/health`):

- `DATABASE_URL` — conecte o plugin **PostgreSQL** ao serviço e use a URL que o Railway gera (referência ` ${{ Postgres.DATABASE_URL }}` ou copiar do plugin).
- `JWT_SECRET` — string longa e aleatória (ex. 32+ caracteres). Sem isto, a inicialização falha em ciclo com `[bootstrap] … JWT_SECRET` nos Deploy Logs.
- `WEB_ORIGIN` — URL **exata** do frontend (ex. `https://xxx.up.railway.app`). **Sem barra no fim.** Em **produção** (`NODE_ENV=production`), pedidos HTTPS vindos de **qualquer** `*.up.railway.app` também são aceitos por CORS (Railway), salvo se você definir `CORS_ALLOW_RAILWAY_PUBLIC=0`. Use `WEB_ORIGIN` para dev local e para restringir origens em deploy próprio.
- `PORT` — normalmente injetado pelo Railway; não remova.

**Não definir no serviço da API** (não são lidas pelo Nest e confundem o painel): `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_OHIF_BASE_PATH`, `POSTGRES_USER`, `POSTGRES_PASSWORD` — basta **`DATABASE_URL`** (já inclui user/password do Postgres). As `NEXT_PUBLIC_*` são só do **build do Web**.

| Serviço | Variáveis (resumo) |
|---------|-------------------|
| **API** | `DATABASE_URL`, `JWT_SECRET`, **`WEB_ORIGIN`** (URL HTTPS do **portal Web**, sem `/` no fim), opcional `ORTHANC_DICOMWEB_ROOT` / credenciais Orthanc |
| **Web** | `NEXT_PUBLIC_API_URL` (URL HTTPS da **API**, pode terminar em `/api`), `NEXT_PUBLIC_OHIF_BASE_PATH=/ohif` |

Exemplo: se a API pública for `https://pacs-viewer-production.up.railway.app` e o portal `https://pacs-viewer-web-production.up.railway.app`, então **na API** defina `WEB_ORIGIN=https://pacs-viewer-web-production.up.railway.app` e **no Web** defina `NEXT_PUBLIC_API_URL=https://pacs-viewer-production.up.railway.app/api`.

Se o healthcheck falhar, abra **Deploy Logs**: mensagens como variável obrigatória **ausente** ou erros de `prisma migrate` / `P1001` indicam banco ou rede.

1. Serviços recomendados: **PostgreSQL**, **API** (`Dockerfile` na raiz do repo), **Web** (`web/Dockerfile`). Já **não** é necessário um serviço OHIF à parte.  
2. Na API: `DATABASE_URL`, `JWT_SECRET`, `WEB_ORIGIN` (URL exata do frontend), `ORTHANC_DICOMWEB_ROOT`, e credenciais Orthanc se necessário.  
3. Na Web — variáveis de **build**: `NEXT_PUBLIC_API_URL` = URL **HTTPS** da API, **com ou sem** sufixo `/api` (o frontend normaliza para `…/api`). Também `NEXT_PUBLIC_OHIF_BASE_PATH=/ohif`. A imagem final usa Next **standalone** (`web/docker-entrypoint.sh` + `node server.js`). **Não** é necessário `DATABASE_URL` no serviço Web.  
4. **Config as Code por serviço (obrigatório):** O repositório **não** tem `railway.json` na raiz — antes, o Railway aplicava a mesma config a **todos** os serviços e o **Web** compilava a imagem da API (Prisma / P1012). Em cada serviço → **Settings** → **Config-as-code** / **Configuration file** → caminho **desde a raiz do Git** (não segue “Root Directory”, ver [monorepo](https://docs.railway.com/deployments/monorepo)): serviço **API** → **`api/railway.json`**; serviço **Web** → **`web/railway.json`**.  
5. **Root Directory** de ambos os serviços: vazio (raiz do repositório), para o Docker usar o contexto do monorepo (`COPY api/…`, `COPY web/…`). Só use “Root Directory” = `web` se duplicar a lógica dos Dockerfiles.  
6. Se ainda aparecer **P1012** no Web, verifique se o arquivo de config desse serviço é mesmo **`web/railway.json`** (não o da API) e faça **Redeploy**.  
7. Se o build da **API** falhar com **Railpack** (“could not determine how to build”), o projeto passou a ter **`Dockerfile` na raiz** (Nest). No serviço API use **Docker** / **`Dockerfile`** ou o config `api/railway.json`. O **Web** continua com **`web/Dockerfile`** (não use só o `./Dockerfile` da raiz no serviço Web).

Em produção use HTTPS; o rewrite DICOMweb usa `NEXT_PUBLIC_API_URL` definida no **build** do Web (destino do proxy `/bb-api/dicomweb`).

**502 no domínio público do serviço Web** — o proxy do Railway encaminha para **a mesma porta em que o Node está em escuta** (`process.env.PORT` injetado pelo Railway). Se no **Networking** você definir manualmente **“porta 3000”** mas o Railway tiver definido `PORT` para outro valor (ex. `8080`), nada escuta na 3000 e aparece **502**. **Correção:** no serviço **Web** → **Networking**, remova a porta personalizada e volte a **gerar o domínio** (configuração **padrão**), *ou* defina **Target port = `$PORT`** / o valor que Railway mostra na documentação, *ou* garanta explicitamente nas **Variables** `PORT=3000` **e** target 3000 — mas o mais simples é **não forçar 3000** e deixar o Railway alinhar com `PORT`. Verifique nos **Deploy Logs** que `node server.js` iniciou sem erro.

## Endpoints REST principais (prefixo `/api`)

- `POST /api/auth/login` — JWT.  
- `GET /api/auth/me` — usuário atual.  
- `GET /api/studies/me` — estudos visíveis ao perfil.  
- `GET|POST|… /api/dicomweb/*` — proxy para Orthanc (autenticado).  
- Admin: `GET /api/users`, `POST /api/users`, `GET /api/patients`, `POST /api/patients`, `GET /api/studies`, `POST /api/studies`, `GET|POST|DELETE /api/permissions`, `GET /api/audit/logs` (lista paginada de mutações REST), etc.

Auditoria: interceptor em mutações (exceto login e tráfego DICOMweb).

## Segurança (MVP)

- **`JWT_EXPIRES_SEC`**: interpretado em segundos com **clamp** entre **300** e **604800** (7 dias); valores fora do intervalo são ajustados e registra-se um aviso na inicialização da API. Os tokens continuam só no **Authorization** (e opcionalmente na query do OHIF); não há refresh token nesta versão — sessões longas implicam novo login ou subir o TTL com consciência do risco.  
- **CORS**: origens a partir de `WEB_ORIGIN` (lista separada por vírgulas); em produção, `*.up.railway.app` continua permitido salvo `CORS_ALLOW_RAILWAY_PUBLIC=0`. Recusas passam a ser registradas como **JSON** (`event: "cors.denied"`). Foi definido `maxAge` de 24 h para respostas preflight. Pedidos **sem** cabeçalho `Origin` continuam aceitos (útil para ferramentas tipo `curl` e alguns healthchecks); o navegador em uso normal no portal envia `Origin` nas chamadas cross-origin para a API.  
- Em **produção**, o serviço Web envia cabeçalho **`Content-Security-Policy`** (sem dependência de domínios externos no viewer; `connect-src` inclui a origem derivada de `NEXT_PUBLIC_API_URL` quando é URL absoluta). Em `next dev` o cabeçalho não é aplicado para não quebrar Turbopack / WebSockets.  
- **Cookies HttpOnly / BFF (roadmap)** — passos típicos para retirar o JWT do `localStorage`: (1) endpoint de login na mesma origem que o navegador (BFF Next ou API atrás do mesmo domínio reverso); (2) `Set-Cookie` com `HttpOnly`, `Secure`, `SameSite` adequado (**são** muitas vezes `lax` ou `strict` conforme iframe/pop-up); (3) CSRF se usar cookies em mutações (token duplo cookie, ou `SameSite=strict` com cuidado com OHIF em pop-up); (4) o viewer OHIF deixa de levar token na query — ex.: cookie de sessão visível só no domínio da API com `credentials: 'include'` no fetch do `app-config` / axios (implica CORS com `credentials` e origem explícita). Esta arquitetura não está implementada no MVP atual; convém planejar antes de exposição ampla na Internet.  
- Token na query do OHIF pode aparecer em logs de proxies — minimize retenção e use HTTPS.  
- Rate limit global (`ThrottlerModule`) aplicado à API. **`POST /api/auth/login`** tem limite **mais apertado** (*padrão*: 20 tentativas / minuto por IP), configurável com `AUTH_LOGIN_THROTTLE_LIMIT` e `AUTH_LOGIN_THROTTLE_TTL_MS`. Em produção atrás de proxy (Railway, etc.), definir **`TRUST_PROXY_HOPS=1`** (ou mais hops) para o Express usar `X-Forwarded-For` em `req.ip` e o throttle identificar cliente real.

## Observabilidade (proxy DICOMweb)

Cada pedido ao proxy **`/api/dicomweb`** gera linhas de log em JSON (nível `log`) com o `Logger` do Nest, por exemplo:

- `event: "dicomweb.proxy"` — método, caminho do cliente (com `access_token=[redacted]` na query), caminho upstream, `statusCode`, `durationMs`, `userId`, `role`, `bytesOut` quando disponível.  
- `event: "dicomweb.access_denied"` — tentativa de acesso a estudo não autorizado.  
- `event: "dicomweb.upstream_error"` — falha ao contatar o Orthanc (mensagem de erro interna, sem corpo clínico).

Isso facilita filtrar no agregador de logs (Datadog, Cloud Logging, etc.) antes da primeira integração PACS.

## Licença

Código de exemplo para integração clínica — ajuste conforme compliance (HIPAA, LGPD / GDPR, CFM, etc.).
