# Plano de melhoria — operação e qualidade

Este plano estrutura evoluções do monorepo `pacs-viewer`. Itens marcados como **feito nesta revisão** já estão aplicados no repositório; os seguintes ficam como backlog priorizado.

## Fase A — Gatilhos e segurança operacional ✅

| Item | Objetivo |
|------|-----------|
| **CI (GitHub Actions)** | Falhar rápido em PR/push (`main`): **API** — `prisma generate`, `nest build`, `jest`; **Web** — `eslint --max-warnings 0`, `next build` (env público fictício para CSP). ESLint estrito sem `--fix` na API fica como **melhoria futura** até alinhar Prettier/arquivos legados (`npm run lint` local já usa `--fix`). |
| **`SKIP_DB_SEED`** | Em produção clínica, evitar rodar `prisma db seed` a cada deploy (sobrescrita das contas demo). Quando não definido, mantém comportamento atual (seed executado). Aceita `1`, `true` ou `yes`. |

## Fase B — Curto prazo (sugerido a seguir)

- Incluir no CI da **API** o passo **`eslint --max-warnings 0`** (sem `--fix`) depois de alinhar o repositório com Prettier/local `npm run lint`.
- Throttle combinado por **IP + email** no login e/ou CAPTCHA após falhas repetidas (`docs/roadmap-produto.md`).
- **Dependabot/Renovate** (weekly) para `api` e `web`.
- Opcional: job Playwright apenas **manual** ou em branch `staging` (stack completa + tempo).

## Fase C — Médio prazo (produto/compliance)

- Sessão com **cookies HttpOnly** / BFF (reduz XSS + exfiltração do JWT descrito em `docs/seguranca-da-informacao.md`).
- Lista de estudos grande: filtros/paginação no QIDO (roadmap §1).

## Convenções

- **Railway:** serviço **API** → `Dockerfile` na raiz OU `api/railway.json` com `SKIP_DB_SEED=1` quando não quiser demo seed. Serviço **Web** → `web/Dockerfile` + `web/railway.json`.
- Lint local API: `npm run lint` (com `--fix`).

---

*Última atualização: Maio de 2026.*
