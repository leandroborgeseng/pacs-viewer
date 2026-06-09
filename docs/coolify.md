# Deploy no Coolify (Docker Compose — opção 1)

Pilha **Postgres + API + Web** num único recurso Docker Compose, usando [`docker-compose.coolify.yml`](../docker-compose.coolify.yml) na raiz do repositório.

O OHIF continua **dentro da imagem Web** (build pesado na primeira vez). O PACS (Orthanc) é **externo** por padrão; há profile opcional `local-pacs` para Orthanc no mesmo compose.

---

## Pré-requisitos

- Servidor com **Coolify** instalado (v4+ recomendado).
- **Dois domínios** (ou subdomínios) com HTTPS, por exemplo:
  - `portal.seudominio.com` → serviço **`web`**
  - `api.seudominio.com` → serviço **`api`**
- **RAM:** reserve **≥ 8 GB** para o **build** do serviço `web` (fase OHIF). Runtime costuma bastar com menos.
- Acesso de rede do container **`api`** até o **DICOMweb** do PACS (`ORTHANC_DICOMWEB_ROOT`).

---

## Passo a passo no Coolify

### 1. Novo recurso

1. **+ New Resource** → **Docker Compose**.
2. Conecte o repositório Git (`pacs-viewer`) ou use deploy manual.
3. **Compose file:** `docker-compose.coolify.yml` (raiz do repo).
4. **Base directory / root:** raiz do monorepo (`.`). **Não** use só a pasta `web/`.

### 2. Variáveis de ambiente

Copie de [`.env.coolify.example`](../.env.coolify.example) e preencha no painel **Environment Variables** do recurso.

| Variável | Obrigatória | Exemplo |
|----------|-------------|---------|
| `POSTGRES_PASSWORD` | Sim | senha forte |
| `JWT_SECRET` | Sim | `openssl rand -hex 32` |
| `WEB_ORIGIN` | Sim | `https://portal.seudominio.com` (sem `/` no fim) |
| `NEXT_PUBLIC_API_URL` | Sim | `https://api.seudominio.com/api` |
| `ORTHANC_DICOMWEB_ROOT` | Sim | URL DICOMweb vista **pelo container api** |
| `SKIP_DB_SEED` | Recomendado | `1` em produção |
| `TRUST_PROXY_HOPS` | Recomendado | `1` |
| `CORS_ALLOW_RAILWAY_PUBLIC` | Opcional | `0` (padrão no compose) |

> **`NEXT_PUBLIC_API_URL` é de build:** alterou o domínio da API → **rebuild** do serviço `web`.

### 3. Domínios e proxy

No recurso Compose, para cada serviço exposto:

| Serviço | Domínio | Healthcheck (Coolify) |
|---------|---------|------------------------|
| **web** | `https://portal.seudominio.com` | `/healthz` |
| **api** | `https://api.seudominio.com` | `/health` |

- Deixe o Coolify/Traefik definir **`PORT`** (normalmente `3000` nos containers).
- **Não** mapeie portas `3000:3000` no host — o compose de produção não publica portas; o proxy do Coolify encaminha.

### 4. Deploy

1. **Deploy** (primeira vez demora: clone OHIF + `yarn build` + `next build`).
2. Logs do **`api`:** deve aparecer `prisma migrate deploy` e, com `SKIP_DB_SEED=1`, mensagem de seed omitido.
3. Logs do **`web`:** `node server.js` na porta efetiva (ver banner do entrypoint).
4. Abra o portal → login (se `SKIP_DB_SEED=0` na primeira vez, contas demo do seed; senão crie usuários pela API/admin).

---

## Primeiro acesso (laboratório)

Se quiser contas demo na **primeira** subida:

```env
SKIP_DB_SEED=0
SEED_STUDY_INSTANCE_UID=<UID de um estudo real no PACS>
```

Depois volte para `SKIP_DB_SEED=1`.

Contas demo (quando o seed roda):

- `admin@portal.local` / `Admin123!`
- `medico@portal.local` / `Medico123!`
- `paciente@portal.local` / `Paciente123!`

---

## Orthanc local (opcional)

Se não tiver PACS remoto, ative o profile no Coolify (ou localmente):

```bash
docker compose -f docker-compose.coolify.yml --profile local-pacs up -d
```

E configure:

```env
ORTHANC_DICOMWEB_ROOT=http://orthanc:8042/dicom-web
```

Associe domínio ao serviço `orthanc` só se precisar de UI web do Orthanc; a API fala na rede interna Docker.

---

## Checklist de problemas comuns

| Sintoma | Causa provável | Correção |
|---------|----------------|----------|
| Login OK, exames vazios / erro PACS | `ORTHANC_DICOMWEB_ROOT` inacessível do container `api` | Teste URL de **dentro** do container; VPN/firewall |
| OHIF não carrega estudos | `NEXT_PUBLIC_API_URL` errado no **build** da web | Rebuild `web` com URL HTTPS correta |
| CORS no browser | `WEB_ORIGIN` ≠ URL do portal | Ajuste exato (scheme + host, sem `/` final) |
| 502 no portal | Porta do proxy ≠ `PORT` do container | Healthcheck `/healthz`; confira logs do entrypoint |
| Build web OOM | Pouca RAM no builder | Aumente RAM do servidor ou build em máquina maior e push da imagem |
| Contas demo reaparecem | Seed a cada deploy | `SKIP_DB_SEED=1` |

---

## Diferença em relação ao `docker-compose.yml` de dev

| | `docker-compose.yml` | `docker-compose.coolify.yml` |
|--|----------------------|------------------------------|
| URLs | `localhost` | Variáveis HTTPS públicas |
| Portas publicadas | Sim (3000, 3001, 5432) | Não (proxy Coolify) |
| Healthchecks | Não | Sim (`db`, `api`, `web`) |
| Seed | Sempre (demo) | Padrão `SKIP_DB_SEED=1` |
| PACS | IP fixo no exemplo | Só via env |

---

## Atualizações

1. Push no Git → redeploy no Coolify.
2. Mudou **só** variáveis runtime da API → redeploy `api` (e às vezes `web` se CORS/origem).
3. Mudou **domínio da API** → **rebuild obrigatório** do serviço `web`.

---

*Maio de 2026.*
