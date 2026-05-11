"use client";

import { startTransition, useEffect, useState } from "react";
import { toast } from "sonner";
import { PencilIcon, Loader2, Globe, ScrollText } from "lucide-react";
import {
  apiFetch,
  formatApiError,
  type AuditLogsPageResponse,
  type IntegrationPacsAdminDto,
  type IntegrationPacsTestResponse,
} from "@/lib/api";
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
import { Input } from "@/components/ui/input";
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

type PacsFormDraft = {
  tls: boolean;
  host: string;
  port: number;
  dicomPath: string;
  user: string;
  webOrigin: string;
  laudoMfr: string;
  laudoSeries: string;
  proxyDebug: boolean;
};

export default function AdminPage() {
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [patients, setPatients] = useState<PatientRow[] | null>(null);
  const [studies, setStudies] = useState<StudyAdmin[] | null>(null);
  const [perms, setPerms] = useState<PermissionRow[] | null>(null);
  const [reportEditor, setReportEditor] = useState<ReportEditorState | null>(null);
  const [savingReportUrl, setSavingReportUrl] = useState(false);
  const [pacs, setPacs] = useState<IntegrationPacsAdminDto | null>(null);
  const [pacsDraft, setPacsDraft] = useState<PacsFormDraft>({
    tls: false,
    host: "",
    port: 8042,
    dicomPath: "/dicom-web",
    user: "",
    webOrigin: "",
    laudoMfr: "",
    laudoSeries: "",
    proxyDebug: false,
  });
  const [pacsPwdNew, setPacsPwdNew] = useState("");
  const [pacsClearPwd, setPacsClearPwd] = useState(false);
  const [savingPacs, setSavingPacs] = useState(false);
  const [testingPacs, setTestingPacs] = useState(false);
  const [adminTab, setAdminTab] = useState("users");
  const [auditLogs, setAuditLogs] = useState<AuditLogsPageResponse | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(25);
  const [auditFilterDraft, setAuditFilterDraft] = useState({
    action: "",
    userId: "",
    from: "",
    to: "",
  });
  const [auditFilters, setAuditFilters] = useState({
    action: "",
    userId: "",
    from: "",
    to: "",
  });

  /** Carrega cada aba sob demanda — evita travar o navegador com /studies ou /permissions muito grandes. */
  useEffect(() => {
    if (adminTab !== "users" || users !== null) return;
    let cancelled = false;
    void (async () => {
      try {
        const u = await apiFetch<UserRow[]>("/users");
        if (!cancelled) setUsers(u);
      } catch {
        if (!cancelled) toast.error("Não foi possível carregar usuários");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adminTab, users]);

  useEffect(() => {
    if (adminTab !== "patients" || patients !== null) return;
    let cancelled = false;
    void (async () => {
      try {
        const p = await apiFetch<PatientRow[]>("/patients");
        if (!cancelled) setPatients(p);
      } catch {
        if (!cancelled) toast.error("Não foi possível carregar pacientes");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adminTab, patients]);

  useEffect(() => {
    if (adminTab !== "studies" || studies !== null) return;
    let cancelled = false;
    void (async () => {
      try {
        const s = await apiFetch<StudyAdmin[]>("/studies");
        if (!cancelled) startTransition(() => setStudies(s));
      } catch {
        if (!cancelled) toast.error("Não foi possível carregar estudos");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adminTab, studies]);

  useEffect(() => {
    if (adminTab !== "perms" || perms !== null) return;
    let cancelled = false;
    void (async () => {
      try {
        const perm = await apiFetch<PermissionRow[]>("/permissions");
        if (!cancelled) setPerms(perm);
      } catch {
        if (!cancelled) toast.error("Não foi possível carregar permissões");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adminTab, perms]);

  useEffect(() => {
    if (adminTab !== "integration" || pacs !== null) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiFetch<IntegrationPacsAdminDto>("/integration/pacs");
        if (!cancelled) setPacs(data);
      } catch (err) {
        if (!cancelled)
          toast.error(formatApiError(err, "Não foi possível carregar a integração com o PACS"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adminTab, pacs]);

  useEffect(() => {
    if (adminTab !== "audit") return;
    let cancelled = false;
    setAuditLoading(true);
    void (async () => {
      try {
        const sp = new URLSearchParams();
        sp.set("page", String(auditPage));
        sp.set("pageSize", String(auditPageSize));
        if (auditFilters.action.trim())
          sp.set("action", auditFilters.action.trim());
        if (auditFilters.userId.trim())
          sp.set("userId", auditFilters.userId.trim());
        if (auditFilters.from.trim()) sp.set("from", auditFilters.from.trim());
        if (auditFilters.to.trim()) sp.set("to", auditFilters.to.trim());
        const data = await apiFetch<AuditLogsPageResponse>(
          `/audit/logs?${sp.toString()}`,
        );
        if (!cancelled) setAuditLogs(data);
      } catch (err) {
        if (!cancelled) {
          toast.error(formatApiError(err, "Não foi possível carregar a auditoria"));
          setAuditLogs(null);
        }
      } finally {
        if (!cancelled) setAuditLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adminTab, auditPage, auditPageSize, auditFilters]);

  useEffect(() => {
    if (!pacs) return;
    setPacsDraft({
      tls: pacs.orthancUseTls,
      host: pacs.orthancHost ?? "",
      port: pacs.orthancPort,
      dicomPath: pacs.orthancDicomWebPath || "/dicom-web",
      user: pacs.orthancUsername ?? "",
      webOrigin: pacs.webOriginPublic ?? "",
      laudoMfr: pacs.laudoManufacturer ?? "",
      laudoSeries: pacs.laudoSeriesNumber ?? "",
      proxyDebug: pacs.dicomProxyDebug,
    });
    setPacsPwdNew("");
    setPacsClearPwd(false);
  }, [pacs]);

  async function savePacsConfig() {
    setSavingPacs(true);
    try {
      const body: Record<string, unknown> = {
        orthancUseTls: pacsDraft.tls,
        orthancHost: pacsDraft.host.trim(),
        orthancPort: pacsDraft.port,
        orthancDicomWebPath: pacsDraft.dicomPath.trim() || "/dicom-web",
        orthancUsername: pacsDraft.user.trim(),
        webOriginPublic: pacsDraft.webOrigin.trim(),
        laudoManufacturer: pacsDraft.laudoMfr.trim(),
        laudoSeriesNumber: pacsDraft.laudoSeries.trim(),
        dicomProxyDebug: pacsDraft.proxyDebug,
        clearStoredOrthancPassword: pacsClearPwd || undefined,
      };
      const pw = pacsPwdNew.trim();
      if (pw.length > 0) body.orthancPasswordNew = pw;
      const next = await apiFetch<IntegrationPacsAdminDto>("/integration/pacs", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setPacs(next);
      toast.success("Integração gravada.");
    } catch (err) {
      toast.error(formatApiError(err, "Não foi possível gravar a integração"));
    } finally {
      setSavingPacs(false);
    }
  }

  async function testPacsConnection() {
    setTestingPacs(true);
    try {
      const r = await apiFetch<IntegrationPacsTestResponse>("/integration/pacs/test", {
        method: "POST",
      });
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    } catch (err) {
      toast.error(formatApiError(err, "Teste de conexão ao PACS falhou"));
    } finally {
      setTestingPacs(false);
    }
  }

  async function saveStudyReportUrl() {
    if (!reportEditor) return;
    const trimmed = reportEditor.draftUrl.trim();
    if (!trimmed) {
      toast.error(
        "Não é possível remover o URL do laudo pelo portal — faça a gestão no PACS ou indique um URL válido para substituir.",
      );
      return;
    }
    setSavingReportUrl(true);
    try {
      await apiFetch(`/studies/${reportEditor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportUrl: trimmed }),
      });
      setStudies((prev) =>
        prev?.map((row) =>
          row.id === reportEditor.id ? { ...row, reportUrl: trimmed } : row,
        ) ?? null,
      );
      toast.success("Laudo atualizado.");
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
          Visão consolidada de usuários, pacientes, estudos, permissões e{" "}
          <strong className="font-medium text-foreground/85">auditoria de mutações REST</strong>.
          A conexão com o PACS Orthanc e a URL pública do portal são configuradas em{" "}
          <strong className="font-medium text-foreground/85">Integração (PACS)</strong>.
          O URL do laudo por estudo pode ser editado em Estudos.
        </p>
      </div>
      <Tabs value={adminTab} onValueChange={setAdminTab}>
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="patients">Pacientes</TabsTrigger>
          <TabsTrigger value="studies">Estudos</TabsTrigger>
          <TabsTrigger value="perms">Permissões</TabsTrigger>
          <TabsTrigger value="audit" className="gap-1">
            <ScrollText className="size-3.5 opacity-80" aria-hidden />
            Auditoria
          </TabsTrigger>
          <TabsTrigger value="integration" className="gap-1">
            <Globe className="size-3.5 opacity-80" aria-hidden />
            Integração (PACS)
          </TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Usuários</CardTitle>
              <CardDescription>
                POST <span className="font-mono text-xs">/api/users</span> (ADMIN)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!users ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
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
                <p className="text-sm text-muted-foreground">Carregando…</p>
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
                URL estar guardado aqui por estudo. Para alterar o endereço, edite pelo botão Laudo.
                A remoção de conteúdos faz-se no próprio PACS; o portal não apaga estudos nem laudos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!studies ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
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
                          <div className="flex justify-end gap-1">
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
                          </div>
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
                <p className="text-sm text-muted-foreground">Carregando…</p>
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
        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Auditoria (mutações REST)</CardTitle>
              <CardDescription>
                Registo de <strong className="text-foreground/90">POST/PATCH/PUT/DELETE</strong> à
                API (exclui <span className="font-mono text-xs">/auth/login</span> duplicado e
                pedidos massivos a <span className="font-mono text-xs">/dicomweb</span>). Use filtros para
                reduzir resultado; exportação pode evoluir depois.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="bb-audit-action" className="text-xs">
                    Texto na acção
                  </Label>
                  <Input
                    id="bb-audit-action"
                    value={auditFilterDraft.action}
                    onChange={(e) =>
                      setAuditFilterDraft((d) => ({ ...d, action: e.target.value }))
                    }
                    placeholder="ex.: PATCH ou LOGIN"
                    className="h-9 w-[200px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bb-audit-user" className="text-xs">
                    Usuário (UUID)
                  </Label>
                  <Input
                    id="bb-audit-user"
                    value={auditFilterDraft.userId}
                    onChange={(e) =>
                      setAuditFilterDraft((d) => ({ ...d, userId: e.target.value }))
                    }
                    placeholder="user id"
                    className="h-9 w-[260px] font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bb-audit-from" className="text-xs">
                    Desde (data ISO)
                  </Label>
                  <Input
                    id="bb-audit-from"
                    type="date"
                    value={auditFilterDraft.from.length <= 10 ? auditFilterDraft.from : ""}
                    onChange={(e) =>
                      setAuditFilterDraft((d) => ({ ...d, from: e.target.value }))
                    }
                    className="h-9 w-[160px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bb-audit-to" className="text-xs">
                    Até
                  </Label>
                  <Input
                    id="bb-audit-to"
                    type="date"
                    value={auditFilterDraft.to.length <= 10 ? auditFilterDraft.to : ""}
                    onChange={(e) =>
                      setAuditFilterDraft((d) => ({ ...d, to: e.target.value }))
                    }
                    className="h-9 w-[160px]"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="h-9"
                  onClick={() => {
                    setAuditFilters({
                      action: auditFilterDraft.action,
                      userId: auditFilterDraft.userId,
                      from: auditFilterDraft.from,
                      to: auditFilterDraft.to,
                    });
                    setAuditPage(1);
                  }}
                >
                  Aplicar filtros
                </Button>
              </div>
              {auditLoading ? (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Carregando…
                </p>
              ) : !auditLogs ? (
                <p className="text-sm text-muted-foreground">Sem dados.</p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    <span className="tabular-nums font-medium text-foreground">
                      {auditLogs.total.toLocaleString("pt-BR")}
                    </span>{" "}
                    registro(s) · página{" "}
                    <span className="tabular-nums">{auditLogs.page}</span> de{" "}
                    <span className="tabular-nums">
                      {Math.max(1, Math.ceil(auditLogs.total / auditLogs.pageSize))}
                    </span>
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-border/60 bg-background/30">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/60 hover:bg-transparent">
                          <TableHead className="whitespace-nowrap">Data</TableHead>
                          <TableHead>Usuário</TableHead>
                          <TableHead className="min-w-[220px]">Acção</TableHead>
                          <TableHead className="min-w-[140px]">Recurso</TableHead>
                          <TableHead>IP</TableHead>
                          <TableHead className="min-w-[120px]">Metadados</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditLogs.items.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground">
                              Nenhum registro nesta página com estes filtros.
                            </TableCell>
                          </TableRow>
                        ) : (
                          auditLogs.items.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell className="whitespace-nowrap font-mono text-[11px] tabular-nums">
                                {new Date(row.createdAt).toLocaleString("pt-BR")}
                              </TableCell>
                              <TableCell className="text-sm">
                                {row.user ? (
                                  <span>
                                    <span className="font-medium">{row.user.name}</span>
                                    <br />
                                    <span className="text-[11px] text-muted-foreground">
                                      {row.user.email}
                                    </span>
                                  </span>
                                ) : row.userId ? (
                                  <span className="font-mono text-[10px] text-muted-foreground">
                                    {row.userId.slice(0, 8)}…
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="max-w-[320px] break-all font-mono text-[11px]">
                                {row.action}
                              </TableCell>
                              <TableCell className="max-w-[240px] break-all font-mono text-[10px] text-muted-foreground">
                                {row.resource ?? "—"}
                              </TableCell>
                              <TableCell className="font-mono text-[11px]">
                                {row.ip ?? "—"}
                              </TableCell>
                              <TableCell className="max-w-[180px]">
                                <span
                                  className="line-clamp-2 font-mono text-[10px] text-muted-foreground"
                                  title={
                                    row.metadata == null
                                      ? undefined
                                      : JSON.stringify(row.metadata)
                                  }
                                >
                                  {row.metadata == null ? "—" : JSON.stringify(row.metadata)}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      Por página
                      <select
                        className="h-9 rounded-md border border-border/80 bg-background px-2 text-sm"
                        value={auditPageSize}
                        onChange={(e) => {
                          const n = Number.parseInt(e.target.value, 10);
                          setAuditPageSize(Number.isFinite(n) ? n : 25);
                          setAuditPage(1);
                        }}
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-8"
                        aria-label="Página anterior"
                        disabled={auditPage <= 1 || auditLoading}
                        onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                      >
                        ‹
                      </Button>
                      <span className="text-xs tabular-nums">{auditPage}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-8"
                        aria-label="Página seguinte"
                        disabled={
                          auditLoading ||
                          auditPage * auditPageSize >= auditLogs.total
                        }
                        onClick={() =>
                          setAuditPage((p) =>
                            p * auditPageSize < auditLogs.total ? p + 1 : p,
                          )
                        }
                      >
                        ›
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="integration" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex flex-wrap items-center gap-2">
                Integração com o PACS (Orthanc)
                {pacs ? (
                  <Badge variant="outline" className="font-normal">
                    Valor usado pela API · {pacs.resolved.pacsConfiguredVia === "database" ? "campos na banco de dados" : "só variáveis de ambiente"}
                  </Badge>
                ) : null}
              </CardTitle>
              <CardDescription className="max-w-3xl space-y-2 text-sm leading-relaxed">
                <span>
                  A API usa DICOMweb (QIDO) para a lista de exames e REST para ingestão —
                  não é necessário configurar "worklist" DICOM clássico (MWL). Define aqui o
                  <strong className="text-foreground/90"> host/IP e porta </strong>a que{" "}
                  <strong className="text-foreground/90">este servidor Nest</strong> consegue
                  ligar (em Docker/Railway use o nome do serviço ou IP interno da rede).
                </span>
                <span className="block">
                  Campos em branco ("host") fazem uso só das variáveis{" "}
                  <span className="font-mono text-xs">ORTHANC_*</span> no ambiente. A URL
                  pública do portal é usada pelo OHIF (reescrita de links no JSON DICOM).
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!pacs ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
              ) : (
                <>
                  <div className="space-y-2 rounded-lg border border-border/70 bg-muted/15 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Resolvido pela API neste momento
                    </p>
                    <dl className="grid gap-2 text-xs sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <dt className="text-muted-foreground">DICOMweb (QIDO/WADO upstream)</dt>
                        <dd className="break-all font-mono text-[11px] text-foreground">
                          {pacs.resolved.dicomWebRoot}
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-muted-foreground">REST Orthanc (/tools/find, /instances)</dt>
                        <dd className="break-all font-mono text-[11px] text-foreground">
                          {pacs.resolved.httpRoot}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">URL portal (OHIF)</dt>
                        <dd className="break-all font-mono text-[11px] text-foreground">
                          {pacs.resolved.webOriginEffective ?? "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Basic Auth</dt>
                        <dd className="text-[11px] text-foreground">
                          {pacs.resolved.effectiveBasicAuth ? "Configurado" : "Desligado"}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border/70 bg-background/50 px-3 py-3 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-border accent-primary"
                        checked={pacsDraft.tls}
                        onChange={(e) =>
                          setPacsDraft((d) => ({ ...d, tls: e.target.checked }))
                        }
                        disabled={savingPacs}
                      />
                      <span>HTTPS (TLS) no Orthanc</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border/70 bg-background/50 px-3 py-3 text-sm sm:col-span-2">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-border accent-primary"
                        checked={pacsDraft.proxyDebug}
                        onChange={(e) =>
                          setPacsDraft((d) => ({ ...d, proxyDebug: e.target.checked }))
                        }
                        disabled={savingPacs}
                      />
                      <span>
                        Logs detalhados do proxy DICOMweb (equivale{" "}
                        <span className="font-mono text-[11px]">DICOMWEB_PROXY_DEBUG=1</span>)
                      </span>
                    </label>

                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="bb-pacs-host">Host ou IP do PACS</Label>
                      <Input
                        id="bb-pacs-host"
                        value={pacsDraft.host}
                        onChange={(e) =>
                          setPacsDraft((d) => ({ ...d, host: e.target.value }))
                        }
                        placeholder='ex.: 192.168.1.40 ou orthanc.docker'
                        className="font-mono text-sm border-border/80 bg-background/80"
                        disabled={savingPacs}
                        autoComplete="off"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Limpe o campo para voltar apenas ao URL em variáveis de ambiente na API.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bb-pacs-port">Porta REST / DICOMweb</Label>
                      <Input
                        id="bb-pacs-port"
                        type="number"
                        min={1}
                        max={65535}
                        value={pacsDraft.port}
                        onChange={(e) =>
                          setPacsDraft((d) => ({
                            ...d,
                            port: Math.min(
                              65535,
                              Math.max(1, Number(e.target.value) || 8042),
                            ),
                          }))
                        }
                        className="font-mono text-sm tabular-nums border-border/80 bg-background/80"
                        disabled={savingPacs}
                      />
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="bb-pacs-dicom-path">Caminho DICOMweb</Label>
                      <Input
                        id="bb-pacs-dicom-path"
                        value={pacsDraft.dicomPath}
                        onChange={(e) =>
                          setPacsDraft((d) => ({ ...d, dicomPath: e.target.value }))
                        }
                        placeholder="/dicom-web"
                        className="font-mono text-sm border-border/80 bg-background/80"
                        disabled={savingPacs}
                        autoComplete="off"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bb-pacs-user">Usuário Orthanc (opcional)</Label>
                      <Input
                        id="bb-pacs-user"
                        value={pacsDraft.user}
                        onChange={(e) =>
                          setPacsDraft((d) => ({ ...d, user: e.target.value }))
                        }
                        className="border-border/80 bg-background/80"
                        disabled={savingPacs}
                        autoComplete="off"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bb-pacs-pwd">Nova senha (opcional)</Label>
                      <Input
                        id="bb-pacs-pwd"
                        type="password"
                        value={pacsPwdNew}
                        onChange={(e) => setPacsPwdNew(e.target.value)}
                        placeholder={
                          pacs.orthancPasswordStored
                            ? "Deixe vazio para manter"
                            : "Credencial guardada apenas na BD"
                        }
                        className="border-border/80 bg-background/80"
                        disabled={savingPacs}
                        autoComplete="new-password"
                      />
                      {pacs.orthancPasswordStored ? (
                        <p className="text-[11px] text-muted-foreground">
                          Existe senha na banco de dados. Preencher acima substitui;
                          assinalar abaixo remove.
                        </p>
                      ) : null}
                    </div>

                    <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border/70 bg-background/50 px-3 py-3 text-sm sm:col-span-2">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-border accent-primary"
                        checked={pacsClearPwd}
                        onChange={(e) => setPacsClearPwd(e.target.checked)}
                        disabled={savingPacs}
                      />
                      <span>Remover senha armazenada na banco de dados</span>
                    </label>

                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="bb-portal-origin">URL pública do portal (Next)</Label>
                      <Input
                        id="bb-portal-origin"
                        value={pacsDraft.webOrigin}
                        onChange={(e) =>
                          setPacsDraft((d) => ({ ...d, webOrigin: e.target.value }))
                        }
                        placeholder="https://portal.instituicao.pt"
                        className="font-mono text-sm border-border/80 bg-background/80"
                        disabled={savingPacs}
                        autoComplete="off"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Usada pelo proxy DICOM e somada ao{" "}
                        <span className="font-mono">WEB_ORIGIN</span> para CORS. Em produção
                        prefira HTTPS; caso contrário o navegador pode bloquear o OHIF.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bb-laudo-mfr">Fabricante DICOM (laudo PDF)</Label>
                      <Input
                        id="bb-laudo-mfr"
                        value={pacsDraft.laudoMfr}
                        onChange={(e) =>
                          setPacsDraft((d) => ({ ...d, laudoMfr: e.target.value }))
                        }
                        placeholder="Nome da instituição"
                        disabled={savingPacs}
                        autoComplete="off"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bb-laudo-ser">Número de série DOC (laudo PDF)</Label>
                      <Input
                        id="bb-laudo-ser"
                        value={pacsDraft.laudoSeries}
                        onChange={(e) =>
                          setPacsDraft((d) => ({ ...d, laudoSeries: e.target.value }))
                        }
                        placeholder="999"
                        disabled={savingPacs}
                        autoComplete="off"
                      />
                    </div>
                  </div>

                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    As credenciais gravadas ficam na base PostgreSQL sem encriptação de
                    aplicação; limite o acesso de administrador e HTTPS em todos os fluxos.
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      disabled={savingPacs}
                      className="gap-2"
                      onClick={() => void savePacsConfig()}
                    >
                      {savingPacs ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : null}
                      Guardar integração
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={testingPacs || savingPacs}
                      className="gap-2"
                      onClick={() => void testPacsConnection()}
                    >
                      {testingPacs ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : null}
                      Testar conexão (GET /system)
                    </Button>
                  </div>
                </>
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
              endereço abre ao usuário autorizado na worklist ("Ver resultado"). Use
              HTTPS sempre que possível. Só pode indicar ou substituir por um novo URL válido —
              remover o laudo ou o estudo faz-se no PACS.
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
