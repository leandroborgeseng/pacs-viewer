"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/auth-context";
import {
  apiFetch,
  formatApiError,
  type StudiesMeSummary,
} from "@/lib/api";
import { toast } from "sonner";

export default function DashboardPage() {
  const { user, token, loading } = useAuth();
  const [summary, setSummary] = useState<StudiesMeSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  useEffect(() => {
    if (loading) return;

    if (!token) {
      setSummary(null);
      setSummaryLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setSummaryLoading(true);
      try {
        const data = await apiFetch<StudiesMeSummary>(
          "/studies/me/summary",
          {},
          token,
        );
        if (!cancelled) setSummary(data);
      } catch (e) {
        toast.error(
          formatApiError(e, "Não foi possível carregar o resumo do catálogo."),
        );
        if (!cancelled) setSummary(null);
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [loading, token]);

  function formatCount(n: number | null): string {
    if (n == null) return "—";
    return new Intl.NumberFormat("pt-PT").format(n);
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-wide text-muted-foreground">
          Bem-vindo
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{user?.name}</h1>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Catálogo visível</h2>
          <p className="text-sm text-muted-foreground">
            Valores segundo o seu perfil e o mesmo PACS filtrado que em{" "}
            <Link href="/exames" className="text-primary underline-offset-4 hover:underline">
              Exames
            </Link>
            . Séries e instâncias só aparecem em soma quando o Orthanc expõe as contagens
            nos metados de todos os estudos visíveis.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <DashboardStatCard
            title="Estudos"
            helper="Registos de estudo com acesso ao visualizador"
            value={
              summaryLoading ? null : summary ? formatCount(summary.studyCount) : "—"
            }
            pulse={summaryLoading}
          />
          <DashboardStatCard
            title="Com laudo URL"
            helper="Registados na base do portal para abrir relatório externo"
            value={
              summaryLoading
                ? null
                : summary
                  ? formatCount(summary.studiesWithReportUrl)
                  : "—"
            }
            pulse={summaryLoading}
          />
          <DashboardStatCard
            title="Doc. no PACS"
            helper="Estudos com série DOC/OT ou modalidade equivalente nos metados (deteção DICOMweb)"
            value={
              summaryLoading
                ? null
                : summary
                  ? formatCount(summary.studiesWithPacsDocumentLaudo)
                  : "—"
            }
            pulse={summaryLoading}
          />
          <DashboardStatCard
            title="Total de séries"
            helper={
              summary && summary.totalSeries == null && summary.studyCount > 0
                ? "Metadados incompletos nos estudos — soma não mostrada."
                : "Soma apenas quando todas as contagens estão disponíveis no QIDO"
            }
            value={
              summaryLoading
                ? null
                : summary
                  ? formatCount(summary.totalSeries)
                  : "—"
            }
            pulse={summaryLoading}
          />
          <DashboardStatCard
            title="Total de imagens"
            helper={
              summary && summary.totalInstances == null && summary.studyCount > 0
                ? "Metadados incompletos nos estudos — soma não mostrada."
                : "Instâncias (imagens/objects) quando o PACS inclui todas as contagens"
            }
            value={
              summaryLoading
                ? null
                : summary
                  ? formatCount(summary.totalInstances)
                  : "—"
            }
            pulse={summaryLoading}
          />
        </div>
        {summary && summary.modalityTop.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-sm text-muted-foreground">Modalidades:</span>
            {summary.modalityTop.map(({ modality, count }) => (
              <Badge key={modality} variant="outline" className="font-normal">
                {modality}{" "}
                <span className="tabular-nums text-muted-foreground">({count})</span>
              </Badge>
            ))}
          </div>
        ) : null}
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/80 bg-card/40 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base">Perfil ativo</CardTitle>
            <CardDescription>Controlo de acesso no servidor de aplicação</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">{user?.role}</Badge>
          </CardContent>
        </Card>
        <Card className="border-border/80 bg-card/40 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base">Exames</CardTitle>
            <CardDescription>
              {user?.role === "PACIENTE"
                ? "Apenas os seus estudos registados no portal"
                : "Estudos autorizados ou catálogo completo (admin)"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/exames"
              className={cn(
                buttonVariants({ variant: "default", className: "shadow-md shadow-primary/20" }),
              )}
            >
              Abrir lista
            </Link>
          </CardContent>
        </Card>
        <Card className="border-border/80 bg-card/40 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base">Auditoria</CardTitle>
            <CardDescription>
              Registos de operações sensíveis na base de dados institucional
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              A política de retenção e relatórios pode ser alinhada com o DPO / qualidade.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DashboardStatCard(props: {
  title: string;
  helper?: string;
  value: string | null;
  pulse: boolean;
}) {
  const { title, helper, value, pulse } = props;

  return (
    <Card className="border-border/80 bg-card/40 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {helper ? <CardDescription className="line-clamp-2">{helper}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        {pulse ? (
          <div
            className="h-9 max-w-[8rem] animate-pulse rounded-md bg-muted"
            aria-busy
            aria-label="A carregar"
          />
        ) : (
          <p className="text-3xl font-semibold tabular-nums tracking-tight">{value ?? "—"}</p>
        )}
      </CardContent>
    </Card>
  );
}
