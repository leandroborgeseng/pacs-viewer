import type { ApiUser } from "./api";
import { getStoredToken } from "./api";

const WINDOW_NAME = "BlueBeaverViewer";

/** Fallback raro: JWT na query do OHIF (ex.: ambientes sem cookie). Defina `NEXT_PUBLIC_OHIF_TOKEN_IN_QUERY=1` no build Web. */
export const OHIF_INCLUDE_TOKEN_IN_QUERY =
  process.env.NEXT_PUBLIC_OHIF_TOKEN_IN_QUERY === "1";

export function getOhifBasePath(): string {
  return (process.env.NEXT_PUBLIC_OHIF_BASE_PATH ?? "/ohif").replace(/\/$/, "") || "/ohif";
}

/** URL absoluta do viewer DICOM (mesma origem que o portal). Por defeito **sem** JWT na query — proxy usa cookie `bb_dicom_proxy_session` + `localStorage.portal_token`. */
export function buildOhifViewerAbsoluteUrl(
  studyUID: string,
  role: ApiUser["role"],
  tokenOverride?: string | null,
): string {
  if (typeof window === "undefined") return "";
  const base = getOhifBasePath();
  const q = new URLSearchParams({ StudyInstanceUIDs: studyUID, lng: "pt-BR" });
  if (OHIF_INCLUDE_TOKEN_IN_QUERY) {
    const t = tokenOverride ?? getStoredToken();
    if (t) q.set("access_token", t);
  }
  const hash = role === "PACIENTE" ? "#patient" : "";
  return `${window.location.origin}${base}/viewer?${q.toString()}${hash}`;
}

/** Envia dados de sessão para a janela do viewer (bridge BlueBeaver no OHIF). */
export function pushSessionToOhifWindow(win: Window, user: ApiUser | null): void {
  if (!user || typeof window === "undefined") return;
  try {
    win.postMessage(
      {
        source: "bb-portal",
        type: "SESSION",
        user: { name: user.name, email: user.email, role: user.role },
      },
      window.location.origin,
    );
  } catch {
    /* ignore */
  }
}

/**
 * Abre o OHIF em nova janela no tamanho do ecrã disponível (leitura clínica).
 * Reutiliza o mesmo nome de janela para evitar dezenas de separadores.
 */
export function openOhifStudyWindow(studyUID: string, user: ApiUser): Window | null {
  if (typeof window === "undefined") return null;
  const url = buildOhifViewerAbsoluteUrl(
    studyUID,
    user.role,
    OHIF_INCLUDE_TOKEN_IN_QUERY ? getStoredToken() : null,
  );
  const w = window.screen.availWidth;
  const h = window.screen.availHeight;
  const features = [
    "popup=yes",
    `width=${w}`,
    `height=${h}`,
    "left=0",
    "top=0",
    "menubar=no",
    "toolbar=no",
    "location=no",
    "status=no",
    "resizable=yes",
    "scrollbars=yes",
  ].join(",");

  const win = window.open(url, WINDOW_NAME, features);
  if (!win) return null;

  const send = () => pushSessionToOhifWindow(win, user);
  try {
    win.addEventListener("load", send);
  } catch {
    /* ignore */
  }
  setTimeout(send, 150);
  setTimeout(send, 600);
  setTimeout(send, 1800);

  try {
    win.moveTo(0, 0);
    win.resizeTo(w, h);
  } catch {
    /* alguns browsers bloqueiam */
  }
  try {
    win.focus();
  } catch {
    /* ignore */
  }
  return win;
}
