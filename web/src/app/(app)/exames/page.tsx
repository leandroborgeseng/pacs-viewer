"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Columns3,
  Copy,
  ExternalLink,
  FileText,
  ImageIcon,
  MoreHorizontal,
  Search,
} from "lucide-react";
import { apiFetch, formatApiError, type StudyRow } from "@/lib/api";
import { openOhifStudyWindow } from "@/lib/ohif-window";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";
import {
  formatSeriesInstanceLabel,
  formatStudyDatePt,
  studyDateToComparable,
} from "@/lib/study-display";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const PAGE_SIZES = [10, 25, 50] as const;

function WorklistSkeleton() {
  return (
    <div className="space-y-3 p-1" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="h-12 animate-pulse rounded-lg bg-muted/40"
        />
      ))}
    </div>
  );
}

export default function ExamesPage() {
  const { token, user, loading } = useAuth();
  const [rows, setRows] = useState<StudyRow[] | null>(null);
  const [filterPatient, setFilterPatient] = useState("");
  const [filterDesc, setFilterDesc] = useState("");
  const [filterModality, setFilterModality] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(25);
  const [laudo, setLaudo] = useState<{ open: boolean; url: string | null; title: string }>({
    open: false,
    url: null,
    title: "Laudo",
  });

  useEffect(() => {
    if (loading) return;
    if (!token) {
      setRows([]);
      return;
    }

    void (async () => {
      try {
        const data = await apiFetch<StudyRow[]>("/studies/me", {}, token);
        setRows(data);
      } catch (err) {
        toast.error(formatApiError(err, "Não foi possível carregar exames"));
        setRows([]);
      }
    })();
  }, [loading, token]);

  const modalityOptions = useMemo(() => {
    if (!rows?.length) return [];
    const set = new Set<string>();
    for (const s of rows) {
      if (!s.modality) continue;
      for (const part of s.modality.split("\\")) {
        const p = part.trim();
        if (p) set.add(p);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b, "pt"));
  }, [rows]);

  const dateFromN = dateFrom ? studyDateToComparable(dateFrom.replace(/-/g, "")) : null;
  const dateToN = dateTo ? studyDateToComparable(dateTo.replace(/-/g, "")) : null;

  const filtered = useMemo(() => {
    if (!rows) return null;
    const fp = filterPatient.trim().toLowerCase();
    const fd = filterDesc.trim().toLowerCase();
    return rows.filter((s) => {
      if (fp) {
        const hit =
          s.patient.fullName.toLowerCase().includes(fp) ||
          s.patient.medicalRecordNumber.toLowerCase().includes(fp) ||
          s.studyInstanceUID.toLowerCase().includes(fp);
        if (!hit) return false;
      }
      if (fd && !(s.studyDescription ?? "").toLowerCase().includes(fd)) return false;
      if (filterModality) {
        const hay = (s.modality ?? "").toUpperCase();
        if (!hay.includes(filterModality.toUpperCase())) return false;
      }
      const d = studyDateToComparable(s.studyDate);
      if (dateFromN != null && d != null && d < dateFromN) return false;
      if (dateToN != null && d != null && d > dateToN) return false;
      return true;
    });
  }, [rows, filterPatient, filterDesc, filterModality, dateFromN, dateToN]);

  const pageCount =
    filtered == null ? 0 : Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(pageIndex, pageCount - 1);
  const pageSlice =
    filtered == null ? null : filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);

  function clearFilters() {
    setFilterPatient("");
    setFilterDesc("");
    setFilterModality("");
    setDateFrom("");
    setDateTo("");
    setPageIndex(0);
  }

  function handleOpenStudy(studyInstanceUID: string) {
    if (!user) {
      toast.error("Sessão inválida. Volte a iniciar sessão.");
      return;
    }
    const win = openOhifStudyWindow(studyInstanceUID, user);
    if (!win) {
      toast.error(
        "O browser bloqueou a nova janela. Permita pop-ups ou use «Mais» → «Abrir link OHIF» se disponível.",
      );
    }
  }

  async function copyUid(uid: string) {
    try {
      await navigator.clipboard.writeText(uid);
      toast.success("UID copiado para a área de transferência.");
    } catch {
      toast.error("Não foi possível copiar (permissões do browser).");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Exames</h1>
        <p className="text-muted-foreground">
          Worklist institucional alinhada ao PACS · leitura de imagens no OHIF{" "}
          <strong className="font-medium text-foreground/90">em janela dedicada</strong>.
          Dica: use o menu <strong className="text-foreground/85">⋯</strong> em cada linha para
          copiar UID ou abrir o laudo registado na base do portal (quando existir).
        </p>
      </div>

      <Card className="border-border/80 bg-card/50 shadow-lg shadow-black/5 backdrop-blur-sm">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-base">Filtros</CardTitle>
              <CardDescription>
                Pesquisa combinada sobre a lista já carregada · para catálogo muito grande, evoluir
                com pesquisa no servidor mais tarde.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearFilters}
                disabled={rows == null || rows.length === 0}
              >
                Limpar filtros
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2 xl:col-span-2">
              <Label htmlFor="bb-filter-patient" className="text-xs uppercase tracking-wide text-muted-foreground">
                Paciente / prontuário / UID
              </Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="bb-filter-patient"
                  value={filterPatient}
                  onChange={(e) => {
                    setFilterPatient(e.target.value);
                    setPageIndex(0);
                  }}
                  placeholder="Nome, número de utente ou Study UID…"
                  className="h-10 border-border/80 bg-background/80 pl-9"
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bb-filter-mod" className="text-xs uppercase tracking-wide text-muted-foreground">
                Modalidade
              </Label>
              <select
                id="bb-filter-mod"
                value={filterModality}
                onChange={(e) => {
                  setFilterModality(e.target.value);
                  setPageIndex(0);
                }}
                className="flex h-10 w-full rounded-md border border-border/80 bg-background/80 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Todas</option>
                {modalityOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bb-filter-desc" className="text-xs uppercase tracking-wide text-muted-foreground">
                Descrição do exame
              </Label>
              <Input
                id="bb-filter-desc"
                value={filterDesc}
                onChange={(e) => {
                  setFilterDesc(e.target.value);
                  setPageIndex(0);
                }}
                placeholder="Substring na descrição…"
                className="h-10 border-border/80 bg-background/80"
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bb-date-from" className="text-xs uppercase tracking-wide text-muted-foreground">
                Desde (data do exame)
              </Label>
              <Input
                id="bb-date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPageIndex(0);
                }}
                className="h-10 border-border/80 bg-background/80"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bb-date-to" className="text-xs uppercase tracking-wide text-muted-foreground">
                Até (data do exame)
              </Label>
              <Input
                id="bb-date-to"
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPageIndex(0);
                }}
                className="h-10 border-border/80 bg-background/80"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {rows === null ? (
            <>
              <p className="text-sm text-muted-foreground sr-only">
                A carregar lista de exames…
              </p>
              <WorklistSkeleton />
            </>
          ) : (
            <>
              <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <span aria-live="polite">
                  <strong className="text-foreground/90">{filtered?.length ?? 0}</strong>{" "}
                  {filtered?.length === 1 ? "registo visível" : "registos visíveis"}
                  {rows.length > 0 && filtered!.length !== rows.length && (
                    <span className="text-muted-foreground"> ({rows.length} no total)</span>
                  )}
                </span>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Columns3 className="size-4 opacity-70" aria-hidden />
                    <Label htmlFor="bb-page-size" className="text-xs whitespace-nowrap">
                      Por página
                    </Label>
                    <select
                      id="bb-page-size"
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value) as (typeof PAGE_SIZES)[number]);
                        setPageIndex(0);
                      }}
                      className="rounded-md border border-border/70 bg-background/80 px-2 py-1 text-xs"
                    >
                      {PAGE_SIZES.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-8"
                      aria-label="Página anterior"
                      disabled={safePage <= 0}
                      onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                    >
                      <ChevronLeft className="size-4" aria-hidden />
                    </Button>
                    <span className="tabular-nums text-xs text-foreground">
                      Página <strong>{safePage + 1}</strong> de {pageCount}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-8"
                      aria-label="Página seguinte"
                      disabled={safePage >= pageCount - 1}
                      onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
                    >
                      <ChevronRight className="size-4" aria-hidden />
                    </Button>
                  </div>
                </div>
              </div>

              {filtered!.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border/70 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                  {rows.length === 0
                    ? "Sem estudos visíveis para este utilizador."
                    : "Nenhum resultado com estes filtros. Ajuste os critérios ou limpe-os."}
                </p>
              ) : (
                <div className="rounded-xl border border-border/60 bg-background/30 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/60 hover:bg-transparent">
                        <TableHead className="w-[88px]">Imagens</TableHead>
                        <TableHead>Prontuário</TableHead>
                        <TableHead>Paciente</TableHead>
                        <TableHead>Data do exame</TableHead>
                        <TableHead>Mod.</TableHead>
                        <TableHead className="min-w-[160px]">Descrição</TableHead>
                        <TableHead>Se/Img</TableHead>
                        <TableHead>Laudo</TableHead>
                        <TableHead className="w-[52px] text-right" aria-label="Mais ações" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pageSlice!.map((s) => (
                        <TableRow
                          key={s.id}
                          className="group border-border/40 transition-colors hover:bg-primary/[0.06]"
                        >
                          <TableCell>
                            <Button
                              type="button"
                              size="sm"
                              variant="default"
                              className="gap-1.5 shadow-md shadow-primary/20"
                              onClick={() => handleOpenStudy(s.studyInstanceUID)}
                            >
                              <ImageIcon className="size-3.5 opacity-90" aria-hidden />
                              Abrir
                            </Button>
                          </TableCell>
                          <TableCell className="font-mono text-xs tabular-nums">
                            {s.patient.medicalRecordNumber}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{s.patient.fullName}</div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap tabular-nums text-sm">
                            {formatStudyDatePt(s.studyDate)}
                          </TableCell>
                          <TableCell>
                            {s.modality ? (
                              <Badge variant="secondary" className="font-mono text-[10px]">
                                {s.modality.split("\\")[0]}
                              </Badge>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="max-w-[240px] whitespace-normal">
                            <span className="line-clamp-2 text-sm">
                              {s.studyDescription ?? "—"}
                            </span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap font-mono text-xs">
                            {formatSeriesInstanceLabel(s.seriesCount, s.instanceCount)}
                          </TableCell>
                          <TableCell>
                            {s.reportUrl ? (
                              <Button
                                type="button"
                                variant="link"
                                className="h-auto p-0 text-sm"
                                onClick={() =>
                                  setLaudo({
                                    open: true,
                                    url: s.reportUrl ?? null,
                                    title:
                                      `Laudo · ${s.patient.fullName}`.slice(0, 80),
                                  })
                                }
                              >
                                <FileText className="mr-1 inline size-3.5 opacity-90" aria-hidden />
                                Ver resultado
                              </Button>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                className={cn(
                                  buttonVariants({ variant: "outline", size: "icon" }),
                                  "size-8 shrink-0",
                                )}
                                aria-label={`Mais ações · ${s.patient.fullName}`}
                              >
                                <MoreHorizontal className="size-4" aria-hidden />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52">
                                <DropdownMenuItem
                                  onClick={() => handleOpenStudy(s.studyInstanceUID)}
                                  className="gap-2"
                                >
                                  <ExternalLink className="size-3.5" aria-hidden />
                                  Abrir no OHIF
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => void copyUid(s.studyInstanceUID)}
                                  className="gap-2"
                                >
                                  <Copy className="size-3.5" aria-hidden />
                                  Copiar Study UID
                                </DropdownMenuItem>
                                {s.reportUrl ? (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() =>
                                        setLaudo({
                                          open: true,
                                          url: s.reportUrl ?? null,
                                          title: `Laudo · ${s.patient.fullName}`.slice(0, 80),
                                        })
                                      }
                                      className="gap-2"
                                    >
                                      <FileText className="size-3.5" aria-hidden />
                                      Abrir laudo aqui
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() =>
                                        window.open(s.reportUrl ?? "", "_blank", "noopener,noreferrer")
                                      }
                                      className="gap-2"
                                    >
                                      <ExternalLink className="size-3.5" aria-hidden />
                                      Laudo noutro separador
                                    </DropdownMenuItem>
                                  </>
                                ) : null}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Sheet
        open={laudo.open}
        onOpenChange={(open) => setLaudo((prev) => ({ ...prev, open }))}
      >
        <SheetContent side="right" className="w-full sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{laudo.title}</SheetTitle>
            <SheetDescription>
              Resultado clínico ou PDF externo (URL configurada na base do portal). Se o conteúdo
              não carregar por política do site de origem, use «Abrir noutro separador».
            </SheetDescription>
          </SheetHeader>
          {laudo.url ? (
            <div className="mt-4 flex min-h-[70vh] flex-col gap-3">
              <a
                href={laudo.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "inline-flex w-fit gap-2",
                )}
              >
                <ExternalLink className="size-4" aria-hidden />
                Abrir noutro separador
              </a>
              <iframe
                title="Laudo"
                src={laudo.url}
                className="min-h-[60vh] flex-1 rounded-lg border border-border/70 bg-background"
                sandbox="allow-scripts allow-same-origin allow-popups allow-downloads allow-forms allow-popups-to-escape-sandbox"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
