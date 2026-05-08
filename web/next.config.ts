import type { NextConfig } from "next";

/** Segmento de URL (sem / inicial) onde o OHIF estático é servido. */
const ohifSegment =
  (process.env.NEXT_PUBLIC_OHIF_BASE_PATH ?? "/ohif").replace(
    /^\/+|\/+$/g,
    "",
  ) || "ohif";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  /**
   * O OHIF é uma SPA: pedidos a /ohif/viewer não correspondem a ficheiro em disco.
   * Sem isto o Next devolve 404 no iframe; encaminhamos para index.html.
   * Ficheiros reais em /ohif/*.js etc. continuam a ser servidos a partir de public/.
   */
  async rewrites() {
    const b = ohifSegment;
    return {
      afterFiles: [
        { source: `/${b}`, destination: `/${b}/index.html` },
        { source: `/${b}/`, destination: `/${b}/index.html` },
        { source: `/${b}/viewer`, destination: `/${b}/index.html` },
        { source: `/${b}/viewer/`, destination: `/${b}/index.html` },
        { source: `/${b}/viewer/:path*`, destination: `/${b}/index.html` },
      ],
    };
  },
};

export default nextConfig;
