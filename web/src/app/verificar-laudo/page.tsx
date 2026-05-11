"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ApiError,
  API_URL,
  apiFetch,
  type ReportLaudoVerifyResponse,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function VerificarInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const c = sp.get("c")?.trim().toLowerCase().replace(/^0x/, "") ?? "";
  const [manual, setManual] = useState("");

  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "ok"; data: ReportLaudoVerifyResponse }
    | { kind: "err"; message: string }
  >({ kind: "idle" });

  useEffect(() => {
    if (!c || !/^[a-f0-9]{32}$/.test(c)) {
      setState({ kind: "idle" });
      return;
    }
    setState({ kind: "loading" });
    void (async () => {
      try {
        const data = await apiFetch<ReportLaudoVerifyResponse>(
          `/reports/laudos/verify/${encodeURIComponent(c)}`,
        );
        setState({ kind: "ok", data });
      } catch (e) {
        const msg =
          e instanceof ApiError && e.status === 404
            ? "Este código não existe ou foi revogado (ainda não suportamos revogação explícita)."
            : "Não foi possível confirmar este selo.";
        setState({ kind: "err", message: msg });
      }
    })();
  }, [c]);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-12">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Verificar laudo</h1>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
          Consulte se o código impresso ou partilhado corresponde a um registo institucional
          do portal com integridade verificável (selo sintético, não assinatura ICP-Brasil).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {!c ? "Informe o código" : state.kind === "loading" ? "A validar…" : "Resultado"}
          </CardTitle>
          <CardDescription className="text-xs leading-relaxed">
            O código tem 32 caracteres hexadecimais (sem hífenes), igual ao texto do PDF gerado pelo
            portal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-2">
            <Label htmlFor="bb-verify-code">Código (32 caracteres hexadecimais)</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                id="bb-verify-code"
                value={manual}
                onChange={(e) =>
                  setManual(e.target.value.trim().toLowerCase().replace(/^0x/, ""))
                }
                placeholder="colar aqui se não veio na URL"
                className="font-mono text-xs"
                spellCheck={false}
                autoCapitalize="none"
                autoComplete="off"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!/^[a-f0-9]{32}$/.test(manual.trim())}
                onClick={() =>
                  router.push(`/verificar-laudo?c=${encodeURIComponent(manual.trim())}`)
                }
              >
                Consultar
              </Button>
            </div>
          </div>

          {!c ? (
            <p className="text-muted-foreground text-xs">
              Utilize o parâmetro na ligação (<span className="font-mono">?c=</span>) ou o campo
              acima.
            </p>
          ) : null}

          {state.kind === "ok" ? (
            <div className="space-y-2 rounded-md border border-border/70 bg-muted/20 p-3 text-xs">
              <p>
                Registo encontrado{" "}
                <strong className="text-foreground">
                  {state.data.cryptographicIntegrity
                    ? "e selo íntegro"
                    : "mas o selo não confere"}
                </strong>
                . Se o segredo institucional tiver sido alterado após emissão, o selo aparece como
                inválido mesmo com código genuíno.
              </p>
              {state.data.issuerEmailMasked ? (
                <p>
                  <span className="text-muted-foreground">Emissor:</span>{" "}
                  {state.data.issuerEmailMasked}
                </p>
              ) : null}
              {state.data.issuedAtUtc ? (
                <p>
                  <span className="text-muted-foreground">Registo (UTC):</span>{" "}
                  <span className="font-mono">{state.data.issuedAtUtc}</span>
                </p>
              ) : null}
              {state.data.studyInstanceUid ? (
                <p className="break-all">
                  <span className="text-muted-foreground">Study UID:</span>{" "}
                  <span className="font-mono text-[11px]">{state.data.studyInstanceUid}</span>
                </p>
              ) : null}
              {state.data.pdfBinarySha256Short ? (
                <p className="font-mono text-[11px] text-muted-foreground">
                  SHA-256 (PDF gravado pelo portal, resumo): {state.data.pdfBinarySha256Short}
                </p>
              ) : null}
            </div>
          ) : null}

          {state.kind === "err" ? (
            <p className="text-sm text-destructive">{state.message}</p>
          ) : null}

          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">Detalhes técnicos e limitações</summary>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>
                Esta verificação confirma apenas que o código existe na base deste sistema e foi
                associado aos metadados mostrados quando o médico gravou via portal.
              </li>
              <li>
                Não substitui assinatura qualificada de documento médico nem prova jurídica
                forte.
              </li>
              <li>
                API de consulta sem sessão{" "}
                <span className="font-mono">
                  GET {API_URL}/reports/laudos/verify/…
                </span>
              </li>
            </ul>
          </details>

          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-fit inline-flex")}
          >
            Ir para iniciar sessão no portal
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerificarLaudoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground px-4">
          A preparar formulário…
        </div>
      }
    >
      <VerificarInner />
    </Suspense>
  );
}
