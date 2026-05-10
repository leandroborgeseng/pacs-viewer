"use client";

import { useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { ConnectionPill } from "@/components/branding/connection-pill";
import { OHIF_INCLUDE_TOKEN_IN_QUERY, openOhifStudyWindow, buildOhifViewerAbsoluteUrl } from "@/lib/ohif-window";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function ViewerPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">A carregar…</p>
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

  const canOpen = Boolean(studyUID && token && user);

  const absoluteUrl = useMemo(() => {
    if (!canOpen || !studyUID || !user) return null;
    return buildOhifViewerAbsoluteUrl(
      studyUID,
      user.role,
      OHIF_INCLUDE_TOKEN_IN_QUERY ? token : null,
    );
  }, [canOpen, studyUID, token, user]);

  function handleOpenWindow() {
    if (!studyUID || !token || !user) {
      toast.error("Dados de sessão em falta.");
      return;
    }
    const win = openOhifStudyWindow(studyUID, user);
    if (!win) {
      toast.error(
        "Pop-up bloqueado. Permita janelas para este site ou abra o link manualmente abaixo.",
      );
    } else {
      toast.success("Visualizador aberto noutra janela.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Visualizador clínico</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Por defeito o estudo abre numa{" "}
            <strong className="text-foreground/90">janela própria</strong> para leitura a ecrã
            completo. O tráfego ao PACS passa pelo proxy do portal; a sessão usa cookie httpOnly e o
            armazenamento local no mesmo domínio.{" "}
            {OHIF_INCLUDE_TOKEN_IN_QUERY ? (
              <>
                O JWT na query do OHIF está <strong>activo</strong> (
                <code className="text-xs">NEXT_PUBLIC_OHIF_TOKEN_IN_QUERY</code>) para compatibilidade
                excepcional.
              </>
            ) : (
              <>Por defeito o JWT não é colocado na barra de endereços do viewer.</>
            )}
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
            <CardDescription>
              <Link href="/exames" className="text-primary underline-offset-4 hover:underline">
                Vá à lista de exames
              </Link>{" "}
              e abra um estudo.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {studyUID && (
        <Card className="border-border/80 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base">Abrir leitura</CardTitle>
            <CardDescription>
              Utilize o botão para abrir ou reabrir a janela do visualizador. Se o browser pedir,
              autorize pop-ups para este domínio.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              type="button"
              size="lg"
              className="gap-2 bg-primary shadow-lg shadow-primary/25"
              disabled={!canOpen}
              onClick={handleOpenWindow}
            >
              <ExternalLink className="size-4" aria-hidden />
              Abrir em janela (ecrã completo)
            </Button>
            <Link
              href="/exames"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              Voltar aos exames
            </Link>
            {absoluteUrl ? (
              <div className="w-full min-w-0 sm:w-full">
                <p className="mb-1 text-xs text-muted-foreground">
                  Link directo (se o pop-up falhar, copie ou abra num novo separador):
                </p>
                <code className="block max-h-24 overflow-auto rounded-md border border-border/80 bg-background/80 p-2 text-[10px] leading-snug break-all text-muted-foreground">
                  {absoluteUrl}
                </code>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
