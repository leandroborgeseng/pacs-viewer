"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/auth-context";

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-wide text-muted-foreground">
          Bem-vindo
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {user?.name}
        </h1>
        <p className="mt-2 text-muted-foreground max-w-2xl">
          Este painel liga o portal às imagens armazenadas no Orthanc através de um
          proxy DICOMweb autenticado. O seu perfil determina quais estados e ferramentas
          estarão disponíveis no OHIF.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Perfil ativo</CardTitle>
            <CardDescription>Controlo RBAC no backend NestJS</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">{user?.role}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Exames</CardTitle>
            <CardDescription>
              {user?.role === "PACIENTE"
                ? "Apenas os seus estudos registados no portal"
                : "Estudos autorizados ou todos (admin)"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/exames"
              className={cn(buttonVariants({ variant: "default" }))}
            >
              Abrir lista
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Auditoria</CardTitle>
            <CardDescription>
              Operações sensíveis geram registos básicos no PostgreSQL
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Administração pode expandir relatórios conforme política interna.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
