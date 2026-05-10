import { NextRequest, NextResponse } from "next/server";
import { BB_DICOM_PROXY_COOKIE } from "@/lib/bb-dicom-session";

/**
 * Proxy DICOMweb do portal → API Nest (`/api/dicomweb`).
 *
 * Preferência pelo cookie httpOnly **`bb_dicom_proxy_session`** gravado por
 * `POST /api/bb-session` logo após o login (`syncBbDicomProxyCookie`), para todos
 * os pedidos a `/bb-api/*` levarem JWT sem depender de Referer nem do header `Authorization` nos pedidos OHIF.
 *
 * Fallback: Bearer, access_token/token na URL, Referer mesmo origin.
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
  searchWithoutToken: string,
): string {
  const base = apiDicomwebOrigin();
  const rest =
    pathSegments && pathSegments.length > 0 ? `/${pathSegments.join("/")}` : "";
  return `${base}/dicomweb${rest}${searchWithoutToken}`;
}

/** JWT para a Nest (`jwt.strategy`): cookie httpOnly primeiro, depois header/query/Referer. */
function resolveJwtForNest(req: NextRequest): string | null {
  const fromCookie = req.cookies.get(BB_DICOM_PROXY_COOKIE)?.value?.trim();
  if (fromCookie) return fromCookie;

  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const t = auth.slice(7).trim();
    if (t.length > 0) return t;
  }
  const fromUrl =
    req.nextUrl.searchParams.get("access_token") ??
    req.nextUrl.searchParams.get("token");
  if (fromUrl) return fromUrl;

  const ref = req.headers.get("referer");
  if (!ref) return null;
  try {
    const refUrl = new URL(ref);
    if (refUrl.origin !== req.nextUrl.origin) return null;
    return (
      refUrl.searchParams.get("access_token") ??
      refUrl.searchParams.get("token") ??
      null
    );
  } catch {
    return null;
  }
}

function searchParamsWithoutSecrets(req: NextRequest): string {
  const sp = new URLSearchParams(req.nextUrl.searchParams);
  sp.delete("access_token");
  sp.delete("token");
  const q = sp.toString();
  return q ? `?${q}` : "";
}

function forwardRequestHeaders(incoming: Headers): Headers {
  const out = new Headers();
  incoming.forEach((value, key) => {
    const k = key.toLowerCase();
    if (k === "host") return;
    if (k === "cookie") return;
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
  const safeSearch = searchParamsWithoutSecrets(req);
  const target = buildTargetUrl(pathSegments, safeSearch);
  const method = req.method.toUpperCase();
  const headers = forwardRequestHeaders(req.headers);

  const jwt = resolveJwtForNest(req);
  if (jwt) {
    headers.set("authorization", `Bearer ${jwt}`);
  }

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
