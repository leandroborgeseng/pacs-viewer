"use client";

import { useMemo, Suspense, useRef, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";
import { ConnectionPill } from "@/components/aion/connection-pill";

/** Caminho público onde o build do viewer DICOM é servido (mesmo domínio do Next). */
const VIEWER_BASE =
  (process.env.NEXT_PUBLIC_OHIF_BASE_PATH ?? "/ohif").replace(/\/$/, "") || "/ohif";

export default function ViewerPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">A carregar visualizador…</p>
      }
    >
      <ViewerInner />
    </Suspense>
  );
}

function ViewerInner() {
  const params = useSearchParams();
  const router = useRouter();
  const studyUID = params.get("studyUID");
  const { token, user, logout } = useAuth();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const src = useMemo(() => {
    if (!studyUID || !token) return null;
    const q = new URLSearchParams({
      StudyInstanceUIDs: studyUID,
      access_token: token,
    });
    const hash = user?.role === "PACIENTE" ? "#patient" : "";
    return `${VIEWER_BASE}/viewer?${q.toString()}${hash}`;
  }, [studyUID, token, user?.role]);

  const pushSessionToIframe = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win || !user || typeof window === "undefined") return;
    try {
      win.postMessage(
        {
          source: "aion-parent",
          type: "SESSION",
          user: {
            name: user.name,
            email: user.email,
            role: user.role,
          },
        },
        window.location.origin,
      );
    } catch {
      /* ignore */
    }
  }, [user]);

  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      if (typeof window === "undefined" || ev.origin !== window.location.origin) {
        return;
      }
      const d = ev.data as { source?: string; type?: string } | null;
      if (!d || d.source !== "aion-iframe" || d.type !== "AION_LOGOUT") return;
      logout();
      router.replace("/login");
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [logout, router]);

  useEffect(() => {
    if (src && user) {
      pushSessionToIframe();
    }
  }, [src, user, pushSessionToIframe]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Visualizador clínico</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Motor DICOMweb certificado para leitura integrada. O tráfego de imagem passa pelo seu
            backend institucional — o browser não contacta o PACS directamente. No canto inferior do
            viewer aparece a sessão do portal; <strong className="text-foreground/90">Sair</strong>{" "}
            encerra a sessão em todo o site.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ConnectionPill />
          {studyUID ? (
            <span
              className="rounded-lg border border-border/80 bg-card/60 px-2.5 py-1 font-mono text-[10px] text-muted-foreground backdrop-blur-sm md:text-xs"
              title="Study Instance UID"
            >
              <span className="text-foreground/80">UID </span>
              <span className="break-all">{studyUID}</span>
            </span>
          ) : null}
        </div>
      </div>

      {!studyUID && (
        <Card className="border-border/80 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base">Parâmetro em falta</CardTitle>
            <CardDescription>Abra um estudo a partir da lista de exames.</CardDescription>
          </CardHeader>
        </Card>
      )}
      {studyUID && src && (
        <Card className="overflow-hidden border-border/80 p-0 shadow-xl shadow-black/20">
          <CardContent className="p-0">
            <div className="relative h-[min(82vh,920px)] w-full min-h-[420px] rounded-b-lg bg-black md:min-h-[520px]">
              <iframe
                ref={iframeRef}
                title="Aion Imaging — visualizador DICOM"
                src={src}
                className="size-full border-0"
                onLoad={pushSessionToIframe}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
