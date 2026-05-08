"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
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
  patient: { fullName: string };
  _count: { permissions: number };
};

type PermissionRow = {
  id: string;
  user: { email: string; name: string };
  study: { studyInstanceUID: string };
};

export default function AdminPage() {
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [patients, setPatients] = useState<PatientRow[] | null>(null);
  const [studies, setStudies] = useState<StudyAdmin[] | null>(null);
  const [perms, setPerms] = useState<PermissionRow[] | null>(null);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Administração</h1>
        <p className="text-muted-foreground">
          Visão consolidada de utilizadores, pacientes, estudos e permissões. Para
          operações de escrita use a API ou scripts internos nesta fase do MVP.
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
              <CardDescription>UID deve coincidir com o Orthanc</CardDescription>
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
                      <TableHead>UID</TableHead>
                      <TableHead>Permissões</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studies.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{s.patient.fullName}</TableCell>
                        <TableCell>{s.studyDescription ?? "—"}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs">
                          {s.studyInstanceUID}
                        </TableCell>
                        <TableCell>{s._count.permissions}</TableCell>
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
    </div>
  );
}
