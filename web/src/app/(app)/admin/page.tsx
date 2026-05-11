"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PencilIcon, Loader2 } from "lucide-react";
import { apiFetch, formatApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
};

type PatientRow = {
  id: string;
  fullName: string;
  medicalRecordNumber: string;
  user: { email: string } | null;
};

type StudyAdmin = {
  id: string;
  studyInstanceUID: string;
  studyDescription: string | null;
  reportUrl: string | null;
  patient: { fullName: string };
  _count: { permissions: number };
};

type PermissionRow = {
  id: string;
  user: { email: string; name: string };
  study: { studyInstanceUID: string };
};

type ReportEditorState = {
  id: string;
  studyInstanceUID: string;
  patientName: string;
  draftUrl: string;
};

export default function AdminPage() {
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [patients, setPatients] = useState<PatientRow[] | null>(null);
  const [studies, setStudies] = useState<StudyAdmin[] | null>(null);
  const [perms, setPerms] = useState<PermissionRow[] | null>(null);
  const [reportEditor, setReportEditor] = useState<ReportEditorState | null>(null);
  const [savingReportUrl, setSavingReportUrl] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [u, p, s, perm] = await Promise.all([
          apiFetch<UserRow[]>("/users"),
          apiFetch<PatientRow[]>("/patients"),
          apiFetch<StudyAdmin[]>("/studies"),
          apiFetch<PermissionRow[]>("/permissions"),
        ]);
        setUsers(u);
        setPatients(p);
        setStudies(s);
        setPerms(perm);
      } catch {
        toast.error("Falha ao carregar dados administrativos");
      }
    })();
  }, []);

  async function saveStudyReportUrl() {
    if (!reportEditor) return;
    setSavingReportUrl(true);
    try {
      const trimmed = reportEditor.draftUrl.trim();
      const body =
        trimmed === "" ? ({ reportUrl: null } as const) : ({ reportUrl: trimmed } as const);
      await apiFetch(`/studies/${reportEditor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const nextUrl = trimmed === "" ? null : trimmed;
      setStudies((prev) =>
        prev?.map((row) =>
          row.id === reportEditor.id ? { ...row, reportUrl: nextUrl } : row,
        ) ?? null,
      );
      toast.success(trimmed === "" ? "Laudo removido do estudo." : "Laudo atualizado.");
      setReportEditor(null);
    } catch (err) {
      toast.error(formatApiError(err, "Não foi possível guardar o laudo."));
    } finally {
      setSavingReportUrl(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Administração</h1>
        <p className="text-muted-foreground">
          Visão consolidada de utilizadores, pacientes, estudos e permissões. O URL do
          laudo por estudo pode ser editado no separador Estudos sem usar linha de
          comandos.
        </p>
      </div>
      <Tabs defaultValue="users">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="users">Utilizadores</TabsTrigger>
          <TabsTrigger value="patients">Pacientes</TabsTrigger>
          <TabsTrigger value="studies">Estudos</TabsTrigger>
          <TabsTrigger value="perms">Permissões</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Utilizadores</CardTitle>
              <CardDescription>
                POST <span className="font-mono text-xs">/api/users</span> (ADMIN)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!users ? (
                <p className="text-sm text-muted-foreground">A carregar…</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Perfil</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>{u.name}</TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{u.role}</Badge>
                        </TableCell>
                        <TableCell>{u.active ? "Ativo" : "Suspenso"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="patients" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pacientes</CardTitle>
              <CardDescription>
                Prontuário único (PatientID) alinhado com metadados DICOM
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!patients ? (
                <p className="text-sm text-muted-foreground">A carregar…</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Prontuário</TableHead>
                      <TableHead>Conta portal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {patients.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.fullName}</TableCell>
                        <TableCell>{p.medicalRecordNumber}</TableCell>
                        <TableCell>{p.user?.email ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="studies" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Estudos</CardTitle>
              <CardDescription>
                O <strong className="text-foreground/90">StudyInstanceUID</strong> deve
                coincidir com o PACS (Orthanc). O laudo aparece na worklist só depois deste
                URL estar guardado aqui por estudo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!studies ? (
                <p className="text-sm text-muted-foreground">A carregar…</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Laudo URL</TableHead>
                      <TableHead>UID</TableHead>
                      <TableHead className="text-right">Perm.</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studies.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{s.patient.fullName}</TableCell>
                        <TableCell>{s.studyDescription ?? "—"}</TableCell>
                        <TableCell className="max-w-[200px]">
                          <div className="truncate font-mono text-xs">
                            {s.reportUrl ? (
                              <a
                                href={s.reportUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary underline-offset-4 hover:underline"
                                title={s.reportUrl}
                              >
                                {s.reportUrl}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[140px] truncate font-mono text-[10px] text-muted-foreground md:text-xs">
                          {s.studyInstanceUID}
                        </TableCell>
                        <TableCell className="text-right">{s._count.permissions}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() =>
                              setReportEditor({
                                id: s.id,
                                studyInstanceUID: s.studyInstanceUID,
                                patientName: s.patient.fullName,
                                draftUrl: s.reportUrl ?? "",
                              })
                            }
                          >
                            <PencilIcon className="size-3.5" aria-hidden />
                            Laudo
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="perms" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Permissões médico ↔ estudo</CardTitle>
              <CardDescription>
                POST <span className="font-mono text-xs">/api/permissions</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!perms ? (
                <p className="text-sm text-muted-foreground">A carregar…</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Médico</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Estudo UID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {perms.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.user.name}</TableCell>
                        <TableCell>{p.user.email}</TableCell>
                        <TableCell className="max-w-[220px] truncate text-xs">
                          {p.study.studyInstanceUID}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Sheet open={reportEditor !== null} onOpenChange={(o) => !o && setReportEditor(null)}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>URL do resultado clínico (laudo)</SheetTitle>
            <SheetDescription>
              Estudo ligado ao paciente <strong>{reportEditor?.patientName}</strong>. Este
              endereço abre ao utilizador autorizado na worklist («Ver resultado»). Use
              HTTPS sempre que possível.
            </SheetDescription>
          </SheetHeader>
          {reportEditor && (
            <div className="mt-6 flex flex-col gap-5 px-4 pb-8 sm:px-0">
              <div className="space-y-1.5 rounded-md border border-border/70 bg-muted/20 p-3">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Study UID
                </Label>
                <p className="break-all font-mono text-[11px] leading-snug text-foreground">
                  {reportEditor.studyInstanceUID}
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bb-admin-report-url">URL (PDF ou página)</Label>
                <textarea
                  id="bb-admin-report-url"
                  value={reportEditor.draftUrl}
                  onChange={(e) =>
                    setReportEditor((prev) =>
                      prev ? { ...prev, draftUrl: e.target.value } : prev,
                    )
                  }
                  rows={6}
                  placeholder="https://exemplo.instituicao.pt/relatorios/…"
                  className={cn(
                    "placeholder:text-muted-foreground w-full min-h-36 resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30",
                  )}
                />
              </div>
              <SheetFooter className="mt-4 flex-row flex-wrap gap-2 sm:justify-start">
                <Button
                  type="button"
                  disabled={savingReportUrl}
                  onClick={() => void saveStudyReportUrl()}
                  className="gap-2"
                >
                  {savingReportUrl ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : null}
                  Guardar
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={savingReportUrl}
                  onClick={() =>
                    setReportEditor((prev) =>
                      prev ? { ...prev, draftUrl: "" } : prev,
                    )
                  }
                >
                  Limpar campo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={savingReportUrl}
                  onClick={() => setReportEditor(null)}
                >
                  Cancelar
                </Button>
              </SheetFooter>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
