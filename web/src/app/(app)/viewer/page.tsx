"use client";

import { useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";

/** Caminho público onde o build OHIF é servido (mesmo domínio do Next). */
const OHIF_BASE =
  (process.env.NEXT_PUBLIC_OHIF_BASE_PATH ?? "/ohif").replace(/\/$/, "") ||
  "/ohif";

export default function ViewerPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">A carregar viewer…</p>
      }
    >
      <ViewerInner />
    </Suspense>
  );
}

function ViewerInner() {
  const params = useSearchParams();
  const studyUID = params.get("studyUID");
  const { token, user } = useAuth();

  const src = useMemo(() => {
    if (!studyUID || !token) return null;
    const q = new URLSearchParams({
      StudyInstanceUIDs: studyUID,
      access_token: token,
    });
    const hash = user?.role === "PACIENTE" ? "#patient" : "";
    return `${OHIF_BASE}/viewer?${q.toString()}${hash}`;
  }, [studyUID, token, user?.role]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Visualização (OHIF v3)
        </h1>
        <p className="text-sm text-muted-foreground">
          O OHIF está integrado neste mesmo site em{" "}
          <span className="font-mono text-xs">{OHIF_BASE}</span>. Os pedidos
          DICOMweb usam a URL pública da API (
          <span className="font-mono text-xs">…/api/dicomweb</span>) definida no
          build — nunca o Orthanc diretamente a partir do browser.
        </p>
      </div>
      {!studyUID && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Parâmetro em falta</CardTitle>
            <CardDescription>
              Abra um estudo a partir da lista de exames.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
      {studyUID && src && (
        <Card className="overflow-hidden border-muted p-0">
          <CardContent className="p-0">
            <div className="relative h-[min(78vh,900px)] w-full bg-black">
              <iframe title="OHIF Viewer" src={src} className="size-full border-0" />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
