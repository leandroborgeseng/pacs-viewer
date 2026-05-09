"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Search } from "lucide-react";
import { apiFetch, type StudyRow } from "@/lib/api";
import { openOhifStudyWindow } from "@/lib/ohif-window";
import { useAuth } from "@/context/auth-context";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function ExamesPage() {
  const { token, user } = useAuth();
  const [rows, setRows] = useState<StudyRow[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiFetch<StudyRow[]>("/studies/me");
        setRows(data);
      } catch {
        toast.error("Não foi possível carregar exames");
        setRows([]);
      }
    })();
  }, []);

  const filtered =
    rows?.filter((s) => {
      if (!query.trim()) return true;
      const q = query.trim().toLowerCase();
      return (
        s.patient.fullName.toLowerCase().includes(q) ||
        s.patient.medicalRecordNumber.toLowerCase().includes(q) ||
        (s.studyDescription ?? "").toLowerCase().includes(q) ||
        s.studyInstanceUID.toLowerCase().includes(q) ||
        (s.modality ?? "").toLowerCase().includes(q)
      );
    }) ?? null;

  function handleOpenStudy(studyInstanceUID: string) {
    if (!token || !user) {
      toast.error("Sessão inválida. Volte a iniciar sessão.");
      return;
    }
    const win = openOhifStudyWindow(studyInstanceUID, token, user);
    if (!win) {
      toast.error(
        "O browser bloqueou a nova janela. Permita pop-ups para este site ou use o botão «Abrir estudo» outra vez.",
      );
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Exames</h1>
        <p className="text-muted-foreground">
          Catálogo sincronizado com o PACS institucional · leitura em{" "}
          <strong className="font-medium text-foreground/90">janela dedicada</strong> para melhor
          uso do ecrã.
        </p>
      </div>

      <Card className="border-border/80 bg-card/50 shadow-lg shadow-black/5 backdrop-blur-sm">
        <CardHeader className="flex flex-col gap-4 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Lista de estudos</CardTitle>
            <CardDescription>
              Pesquisa em tempo real · o visualizador abre maximizado noutra janela (JWT no URL,
              habitual em viewers clínicos).
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Paciente, NIU, UID, modalidade…"
              className="h-10 border-border/80 bg-background/80 pl-9"
              aria-label="Pesquisar estudos"
            />
          </div>
        </CardHeader>
        <CardContent>
          {!rows ? (
            <p className="text-sm text-muted-foreground">A carregar…</p>
          ) : filtered!.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {rows.length === 0
                ? "Sem estudos visíveis para este utilizador."
                : "Nenhum resultado para esta pesquisa."}
            </p>
          ) : (
            <div className="rounded-xl border border-border/60 bg-background/30 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60 hover:bg-transparent">
                    <TableHead>Paciente</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="font-mono text-xs">UID</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered!.map((s) => (
                    <TableRow
                      key={s.id}
                      className="group border-border/40 transition-colors hover:bg-primary/[0.06]"
                    >
                      <TableCell>
                        <div className="font-medium">{s.patient.fullName}</div>
                        <div className="text-xs text-muted-foreground">
                          {s.patient.medicalRecordNumber}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[220px] whitespace-normal">
                        <span className="line-clamp-2">{s.studyDescription ?? "—"}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="tabular-nums">{s.studyDate ?? "—"}</span>
                          {s.modality && (
                            <Badge variant="secondary" className="font-mono text-[10px]">
                              {s.modality}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="border-0 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20">
                          Disponível
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate font-mono text-[10px] text-muted-foreground md:max-w-[260px] md:text-xs">
                        {s.studyInstanceUID}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          className="gap-1.5 shadow-md shadow-primary/20"
                          onClick={() => handleOpenStudy(s.studyInstanceUID)}
                        >
                          Abrir estudo
                          <ExternalLink className="size-3.5 opacity-80" aria-hidden />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
