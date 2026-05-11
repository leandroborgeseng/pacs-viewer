# Roadmap do produto (BlueBeaver / pacs-viewer)

Referência rápida das fases seguintes após segurança básica (throttle login) e auditoria administrativa (`GET /api/audit/logs` + aba Admin).

## Concluído recentemente

- Cache PACS/RBAC para carga concurrente médica (`perf(api): …`).
- Laudo DOC no PACS na worklist; admin eliminar laudo (URL + selos + Orthanc).
- **Throttle próprio em `POST /api/auth/login`** (`AUTH_LOGIN_THROTTLE_*`, `TRUST_PROXY_HOPS`).
- **Auditoria ADMIN**: lista paginada das mutações REST (`GET /api/audit/logs`).

## Próximo (ordem sugerida)

### 1. Worklist grande — servidor

- **`GET /studies/me`** hoje pode carregar todos os estudos do Orthanc; com catálogo muito grande a API e o navegador sofrem.
- **Melhor**: QIDO Orthanc **com filtros** (Paciente/Data/Modalidades) + **paginação** onde o Orthanc suportar (`limit`) ou por janelas de data.
- Consequência no web: filtros devem estar alinhados com o servidor (ou manter dois modos "offline" vs "servidor" até migração completa).

### 2. Brute force mais fino

- Throttle combinado por **IP + email** ou bloqueio após N falhas na mesma conta.
- Opcional CAPTCHA apenas no login público.

### 3. Sessão e OAuth

- Refresh token ou cookies HttpOnly só para API (impacto OHIF/pop-up já descrito no `README`).
- MFA para ADMIN (e opcional médicos).

### 4. Exportação / retenção

- CSV ou export tratado das linhas `audit_logs` (com período definido pela política institucional).
- Job ou política de **purga**/arquivo de registros antigos.

### 5. Gestão administrativa na UI

- Formulários completos para criar/editar **usuários**, **pacientes**, **permissões** (hoje há leitura e algumas operações dispersas pela API manual).

---

*Maio de 2026.*
