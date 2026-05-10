import { NextResponse } from "next/server";
import { BB_DICOM_PROXY_COOKIE } from "@/lib/bb-dicom-session";

/** Duração alinhada à sessão JWT (ex.: JWT_EXPIRES_SEC na API ~8 h). */
function cookieMaxAgeSec(): number {
  const raw = process.env.BB_SESSION_COOKIE_MAX_AGE_SEC;
  const n = raw !== undefined ? Number.parseInt(raw, 10) : Number.NaN;
  if (!Number.isFinite(n) || n <= 60) return 28800;
  return n;
}

function cookieOpts(maxAge: number) {
  const prod = process.env.NODE_ENV === "production";
  return {
    httpOnly: true as const,
    secure: prod,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "JSON inválido" }, { status: 400 });
  }
  const tok =
    body &&
    typeof body === "object" &&
    "access_token" in body &&
    typeof (body as { access_token?: unknown }).access_token === "string"
      ? (body as { access_token: string }).access_token.trim()
      : "";
  if (!tok) {
    return NextResponse.json({ message: "access_token obrigatório" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });
  const age = cookieMaxAgeSec();
  res.cookies.set(BB_DICOM_PROXY_COOKIE, tok, cookieOpts(age));
  return res;
}

/** Logout portal: remover cookie do proxy OHIF */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  const prod = process.env.NODE_ENV === "production";
  res.cookies.set(BB_DICOM_PROXY_COOKIE, "", {
    ...cookieOpts(0),
    secure: prod,
  });
  return res;
}
