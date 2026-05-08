"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      toast.success("Sessão iniciada");
      router.replace("/dashboard");
    } catch {
      toast.error("Credenciais inválidas ou servidor indisponível");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(129,140,248,0.35),_transparent_55%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
        <div className="mb-8 text-center text-slate-100">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-indigo-500/90 text-lg font-bold shadow-lg shadow-indigo-500/40">
            MV
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">MedView</h1>
          <p className="mt-2 text-sm text-slate-300">
            Portal hospitalar com imagologia integrada (OHIF v3)
          </p>
        </div>
        <Card className="border-white/10 bg-white/95 shadow-2xl shadow-black/40 dark:bg-slate-900/95">
          <CardHeader>
            <CardTitle>Entrar</CardTitle>
            <CardDescription>
              Use o e-mail institucional. O tráfego DICOM passa sempre pelo backend.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Palavra-passe</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "A validar…" : "Continuar"}
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-xs text-slate-400">
          Self-hosted · JWT · RBAC · PostgreSQL · Sem Firebase/Supabase
        </p>
      </div>
    </div>
  );
}
