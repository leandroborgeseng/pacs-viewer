import { NextResponse } from "next/server";

/** Healthcheck estável para proxies (Railway, K8s); evita depender da página raiz (client redirect). */
export async function GET() {
  return NextResponse.json({ status: "ok" }, { status: 200 });
}
