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
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Consola clínica para imagiologia: catálogo de estudos, leitura no visualizador Aion e
          tráfego DICOMweb sempre mediado pelo seu backend.
        </p>
      </div>

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
