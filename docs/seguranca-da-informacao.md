# Segurança da informação — linha de base e melhorias futuras

Documento de referência para alinhar com equipa clínica / DPO / TI. As sugestões marcadas como *futuras* ainda não estão implementadas; voltar a este ficheiro quando for priorizar trabalho.

---

## Contexto do sistema

- Portal web (Next.js) + API (NestJS) + Orthanc (PACS) com DICOMweb mediado pela API.
- Perfis: `ADMIN`, `MEDICO`, `PACIENTE`.
- JWT para sessão na API; proxy DICOMweb com validação de acesso ao `StudyInstanceUID`.

---

## O que já está alinhado (linha de base)

| Área | Notas |
|------|--------|
| Autenticação | JWT; passwords com bcrypt; erro de login genérico («Credenciais inválidas»); **rate limit próprio no login**. |
| Autorização | RBAC; proxy DICOMweb restringe estudos segundo permissões ou vínculo paciente. |
| Validação de entrada | `ValidationPipe` global com whitelist. |
| CORS | Configurável (integração + origens permitidas); evitar origens laxas em produção. |
| Auditoria REST | Interceptor grava operações sensíveis `POST/PATCH/PUT/DELETE` (exc. login já auditado à parte e **excluí** tráfego massivo `/dicomweb`). |
| Frontend produção | CSP configurada no Next (aproximar `connect-src` à API real). |
| Secrets | Bootstrap exige pelo menos `JWT_SECRET`, `DATABASE_URL`; documentação em `.env.example` para outros segredos (ex.: selo de laudos). |

---

## Melhorias sugeridas (priorizar segundo risco institucional)

### 1. Ataques a credenciais (brute force / stuffing)

- **`POST /api/auth/login`**: limite **mais apertado que o global**, por IP (`@nestjs/throttler` no handler), predef. **20 tentativas / 60 s** — `AUTH_LOGIN_THROTTLE_LIMIT`, `AUTH_LOGIN_THROTTLE_TTL_MS` em `api/.env.example`.
- Atrás de reverse proxy: **`TRUST_PROXY_HOPS`** em `main.ts` para `req.ip` / throttle usarem `X-Forwarded-For` (ex.: Railway: `1`).
- *Ainda futuro*: throttle ou bloqueio também **por e‑mail**; CAPTCHA após N falhas; monitorização de IPs anómalos.

### 2. Armazenamento do JWT no browser (XSS)

- Se o token vive em `localStorage`, qualquer XSS pode exfiltrar sessão.
- *Mitigações*: CSP rigorosa, actualização de dependências, evitar HTML inseguro; *médio prazo*: cookies **httpOnly** + **SameSite** (com desenho BFF ou equivalente).

### 3. Segredos e integração PACS

- Rotação periódica de `JWT_SECRET`, `LAUDO_SEAL_*`, credenciais Orthanc.
- Credenciais Orthanc podem estar na BD (sem encriptação de aplicação) — limitar quem é `ADMIN`, restringir ACL no Orthanc, rede privada entre API e PACS.

### 4. Auditoria de acesso a dados clínicos (leitura)

- O interceptor **não** regista cada GET ao proxy DICOMweb (volume OHIF).
- *Futuro* (compliance): definir política — ex.: amostragem, primeiro acesso ao estudo na sessão, ou trilhos agregados com retenção explícita; alinhar com DPO.

### 5. Cabeçalhos HTTP na API

- *Verificar* se um reverse proxy (Railway, Nginx, etc.) injeta HSTS, `X-Content-Type-Options`, etc.; ou usar **Helmet** na Nest se a API for exposta directamente.

### 6. LGPD / dados de saúde

- Registo de actividades de tratamento, base legal, minimização de dados nas listagens.
- Direitos do titular (acesso, retificação, apagamento onde aplicável).
- Subcontratados (hospedagem, PACS) e acordos.
- Backups encriptados e testes de restauro.

### 7. Operação contínua

- Revisão de dependências (Dependabot ou equivalente).
- Contas `ADMIN` com MFA, se a política interna o exigir.
- Testes de intrusão ou revisão de código periódica.
- Política de divulgação responsável de vulnerabilidades (ficheiro `SECURITY.md` à parte, se desejarem).

---

## Ideias de implementação em código (quando retomar)

1. ~~**Throttle específico** em `POST /auth/login` (mais restritivo que o global).~~ **Feito** (Maio 2026).
2. **Auditoria selectiva** de acessos DICOMweb (sem encher a BD).
3. **Helmet** ou documentação clara de cabeçalhos no edge.

---

## Performance (ligação indirecta)

Com muitos utilizadores simultâneos, o desenho actual inclui cache de catálogo PACS, cache de allowlist RBAC no proxy e throttle mais alto no `dicomweb`. Se surgirem problemas, rever ficheiro de commit `perf(api): …` e documentação em `.env.example` (`STUDIES_CATALOG_CACHE_MS`, `ACCESS_ALLOWLIST_CACHE_MS`).

---

## Última revisão do documento

- Criado para arquivo das ideias discutidas em conversa (segurança + referência a performance).
- Actualizar esta data quando o conteúdo mudar substantivemente.

*Data-base: Maio de 2026.*
