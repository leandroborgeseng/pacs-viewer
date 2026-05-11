import type { NextConfig } from "next";

/** Segmento de URL (sem / inicial) onde o OHIF estático é servido. */
const ohifSegment =
  (process.env.NEXT_PUBLIC_OHIF_BASE_PATH ?? "/ohif").replace(
    /^\/+|\/+$/g,
    "",
  ) || "ohif";

/** Origem da API quando `NEXT_PUBLIC_API_URL` é absoluto (para `connect-src`). */
function apiOriginForCsp(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!raw || raw.startsWith("/")) return "";
  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
}

/** CSP em produção: sem Google Fonts/ext. no OHIF; fetch à API alinhado ao env. */
function productionContentSecurityPolicy(): string {
  const api = apiOriginForCsp();
  const connect =
    api && api.length > 0
      ? `'self' blob: data: ${api}`
      : "'self' blob: data:";
  const parts = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    `connect-src ${connect}`,
    "worker-src 'self' blob:",
    "media-src 'self' blob: data:",
    "upgrade-insecure-requests",
  ];
  return parts.join("; ");
}

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  /**
   * O OHIF é uma SPA: pedidos a /ohif/viewer não correspondem a arquivo em disco.
   * Sem isto o Next devolve 404 no iframe; encaminhamos para index.html.
   * Arquivos estáticos em /ohif/*.js etc. continuam a ser servidos a partir de public/.
   */
  async rewrites() {
    const b = ohifSegment;
    return {
      /** DICOMweb mesmo origem → `src/app/bb-api/dicomweb/[[...path]]/route.ts` (preserva Authorization). */
      afterFiles: [
        { source: `/${b}`, destination: `/${b}/index.html` },
        { source: `/${b}/`, destination: `/${b}/index.html` },
        { source: `/${b}/viewer`, destination: `/${b}/index.html` },
        { source: `/${b}/viewer/`, destination: `/${b}/index.html` },
        { source: `/${b}/viewer/:path*`, destination: `/${b}/index.html` },
      ],
    };
  },
  async headers() {
    if (process.env.NODE_ENV !== "production") {
      return [];
    }
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: productionContentSecurityPolicy(),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
