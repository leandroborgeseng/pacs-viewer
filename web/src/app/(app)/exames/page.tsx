"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { apiFetch, type StudyRow } from "@/lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ExamesPage() {
  const [rows, setRows] = useState<StudyRow[] | null>(null);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Exames</h1>
        <p className="text-muted-foreground">
          Cada linha corresponde a um estudo registado no portal (UID sincronizado com o PACS).
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lista</CardTitle>
          <CardDescription>
            A visualização utiliza o OHIF Viewer v3 via URL assinada com JWT (query
            parameter suportada pelo proxy).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!rows ? (
            <p className="text-sm text-muted-foreground">A carregar…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sem estudos visíveis para este utilizador.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>UID</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="font-medium">{s.patient.fullName}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.patient.medicalRecordNumber}
                      </div>
                    </TableCell>
                    <TableCell>{s.studyDescription ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{s.studyDate ?? "—"}</span>
                        {s.modality && <Badge variant="outline">{s.modality}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">
                      {s.studyInstanceUID}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/viewer?studyUID=${encodeURIComponent(s.studyInstanceUID)}`}
                        className={cn(
                          buttonVariants({ variant: "default", size: "sm" }),
                        )}
                      >
                        Abrir OHIF
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
