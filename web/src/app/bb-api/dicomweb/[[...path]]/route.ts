import { NextRequest, NextResponse } from "next/server";

/**
 * OHIF usa `Authorization: Bearer` no mesmo origin (`/bb-api/dicomweb/...`).
 * Os `rewrites` em `next.config.ts` nem sempre propagam esse header até à API Nest
 * em `next start`/standalone → 401 nos QIDO/WADO.
 * Este Route Handler faz `fetch` explícito e reencaminha cabeçalhos (incl. Authorization).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

function apiDicomwebOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_API_URL?.trim() ?? "http://127.0.0.1:3001/api";
  return raw.replace(/\/+$/, "");
}

function buildTargetUrl(
  pathSegments: string[] | undefined,
  search: string,
): string {
  const base = apiDicomwebOrigin();
  const rest =
    pathSegments && pathSegments.length > 0 ? `/${pathSegments.join("/")}` : "";
  return `${base}/dicomweb${rest}${search}`;
}

function forwardRequestHeaders(incoming: Headers): Headers {
  const out = new Headers();
  incoming.forEach((value, key) => {
    const k = key.toLowerCase();
    if (k === "host") return;
    if (HOP_BY_HOP.has(k)) return;
    out.append(key, value);
  });
  return out;
}

function forwardResponseHeaders(incoming: Headers): Headers {
  const out = new Headers();
  incoming.forEach((value, key) => {
    const k = key.toLowerCase();
    if (HOP_BY_HOP.has(k)) return;
    out.append(key, value);
  });
  return out;
}

async function proxyDicomWeb(
  req: NextRequest,
  pathSegments: string[] | undefined,
): Promise<Response> {
  const target = buildTargetUrl(pathSegments, req.nextUrl.search);
  const method = req.method.toUpperCase();
  const headers = forwardRequestHeaders(req.headers);

  const init: RequestInit & { duplex?: "half" } = {
    method,
    headers,
    redirect: "manual",
  };

  if (method !== "GET" && method !== "HEAD") {
    if (req.body) {
      init.body = req.body;
      init.duplex = "half";
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error: "dicomweb_proxy_fetch_failed",
        detail,
      },
      { status: 502 },
    );
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: forwardResponseHeaders(upstream.headers),
  });
}

type RouteCtx = { params: Promise<{ path?: string[] }> };

async function handler(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxyDicomWeb(req, path);
}

export const GET = handler;
export const HEAD = handler;
export const POST = handler;
