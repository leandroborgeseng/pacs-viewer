const raw =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

/** Garante sufixo `/api` (erro típico no Railway: falta `/api` na variável). */
function normalizeApiBase(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/api")) return trimmed;
  return `${trimmed}/api`;
}

export const API_URL = normalizeApiBase(raw);

const TOKEN_KEY = "portal_token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export type ApiUser = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "MEDICO" | "PACIENTE";
};

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const t = token ?? getStoredToken();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (t) headers.set("Authorization", `Bearer ${t}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    let detail: unknown = null;
    try {
      detail = await res.json();
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`HTTP ${status}`);
  }
}

/** Extrai mensagem legível das respostas Nest (`message` string ou array). */
export function formatApiError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const b = err.body as { message?: string | string[] } | null | undefined;
    const m = b?.message;
    if (typeof m === "string" && m.trim()) return m.trim();
    if (Array.isArray(m) && m.length > 0) return m.filter(Boolean).join("; ");
    if (err.status === 401) return "Sessão expirada ou inválida. Faça login novamente.";
    if (err.status === 403) return "Sem permissão para este recurso.";
    if (err.status === 503 || err.status === 502)
      return "Serviço ou PACS temporariamente indisponível. Tente de novo ou verifique os logs da API.";
    return `${fallback} (HTTP ${err.status})`;
  }
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  return fallback;
}

/** Resposta de `GET /studies/me/summary` (mesmo alcance RBAC que a worklist). */
export type StudiesMeSummary = {
  studyCount: number;
  studiesWithReportUrl: number;
  studiesWithPacsDocumentLaudo: number;
  totalSeries: number | null;
  totalInstances: number | null;
  modalityTop: { modality: string; count: number }[];
};

export type AuditLogItem = {
  id: string;
  createdAt: string;
  action: string;
  resource: string | null;
  ip: string | null;
  metadata: unknown;
  userId: string | null;
  user: { id: string; email: string; name: string } | null;
};

export type AuditLogsPageResponse = {
  items: AuditLogItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type PdfLaudoIngestResponse = {
  orthancInstanceId: string;
  sopInstanceUid: string;
  verifyCode: string;
  verificationUrl: string;
};

export type ReportLaudoVerifyResponse = {
  known: boolean;
  cryptographicIntegrity: boolean;
  studyInstanceUid?: string;
  sopInstanceUid?: string;
  issuedAtUtc?: string;
  issuerEmailMasked?: string;
  pdfBinarySha256Short?: string;
};

export type StudyRow = {
  id: string;
  studyInstanceUID: string;
  studyDescription: string | null;
  studyDate: string | null;
  modality: string | null;
  seriesCount?: number | null;
  instanceCount?: number | null;
  reportUrl?: string | null;
  /** Indício de documento encapsulado no PACS (série DOC/OT ou metadados de estudo). */
  hasPacsDocumentLaudo?: boolean;
  patient: {
    id: string;
    fullName: string;
    medicalRecordNumber: string;
  };
};

export type IntegrationResolvedPacs = {
  pacsConfiguredVia: "database" | "environment";
  dicomWebRoot: string;
  httpRoot: string;
  orthancUsername?: string;
  webOriginPublic?: string;
  laudoManufacturer?: string;
  laudoSeriesNumber?: string;
  dicomProxyDebug: boolean;
};

export type IntegrationPacsAdminDto = {
  orthancUseTls: boolean;
  orthancHost: string | null;
  orthancPort: number;
  orthancDicomWebPath: string;
  orthancUsername: string | null;
  orthancPasswordStored: boolean;
  webOriginPublic: string | null;
  laudoManufacturer: string | null;
  laudoSeriesNumber: string | null;
  dicomProxyDebug: boolean;
  resolved: IntegrationResolvedPacs & {
    webOriginEffective?: string;
    effectiveBasicAuth: boolean;
  };
};

export type IntegrationPacsTestResponse = {
  ok: boolean;
  httpStatus?: number;
  orthancReachable?: boolean;
  message: string;
};
