"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Loader2, Lock, Mail } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { AionLogoMark } from "@/components/aion/aion-logo-mark";
import { cn } from "@/lib/utils";

const REMEMBER_EMAIL_KEY = "aion.imaging.rememberEmail";
const REMEMBER_FLAG_KEY = "aion.imaging.rememberUser";

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(REMEMBER_EMAIL_KEY);
      const flag = localStorage.getItem(REMEMBER_FLAG_KEY);
      if (stored && flag === "1") {
        setEmail(stored);
        setRemember(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      try {
        if (remember) {
          localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
          localStorage.setItem(REMEMBER_FLAG_KEY, "1");
        } else {
          localStorage.removeItem(REMEMBER_EMAIL_KEY);
          localStorage.setItem(REMEMBER_FLAG_KEY, "0");
        }
      } catch {
        /* ignore */
      }
      toast.success("Sessão iniciada");
      router.replace("/dashboard");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Credenciais inválidas ou servidor indisponível";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0B1120] text-[#E5E7EB]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.45]"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 20% -10%, rgba(0,102,178,0.55), transparent 55%), radial-gradient(ellipse 70% 50% at 90% 20%, rgba(255,79,0,0.2), transparent 50%), radial-gradient(ellipse 60% 40% at 50% 100%, rgba(0,102,178,0.25), transparent 55%)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(11,17,32,0.2),#0B1120_65%)]" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-14">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="mb-10 text-center"
        >
          <div className="mx-auto mb-5 flex justify-center">
            <AionLogoMark size="lg" className="shadow-[0_20px_50px_-12px_rgba(0,102,178,0.55)]" />
          </div>
          <h1 className="text-[1.75rem] font-semibold tracking-tight text-white">Aion Imaging</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#9CA3AF]">
            Portal enterprise de imagiologia. Acesso seguro e auditoria centralizada.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        >
          <Card
            className={cn(
              "border-[#1F2937] bg-[#111827]/80 shadow-2xl shadow-black/50 backdrop-blur-xl",
              "ring-1 ring-white/[0.06]",
            )}
          >
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-lg text-white">Entrar</CardTitle>
              <CardDescription className="text-[#9CA3AF]">
                Autenticação institucional · ligação encriptada
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[#E5E7EB]">
                    E-mail
                  </Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9CA3AF]" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="username"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-11 border-[#1F2937] bg-[#0B1120]/90 pl-10 text-[#E5E7EB] placeholder:text-[#6B7280] focus-visible:border-[#0066B2] focus-visible:ring-[#0066B2]/30"
                      placeholder="nome@instituicao.pt"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-[#E5E7EB]">
                    Palavra-passe
                  </Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9CA3AF]" />
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-11 border-[#1F2937] bg-[#0B1120]/90 pl-10 text-[#E5E7EB] placeholder:text-[#6B7280] focus-visible:border-[#0066B2] focus-visible:ring-[#0066B2]/30"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
                <label className="flex cursor-pointer items-center gap-2.5 text-sm text-[#9CA3AF]">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="size-4 rounded border-[#1F2937] bg-[#0B1120] text-[#0066B2] focus:ring-[#0066B2]/40"
                  />
                  Lembrar utilizador neste dispositivo
                </label>
                <Button
                  type="submit"
                  disabled={busy}
                  className="flex h-11 w-full items-center justify-center bg-[#0066B2] text-white shadow-lg shadow-[#0066B2]/25 transition hover:bg-[#0078CC]"
                >
                  {busy ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      A validar…
                    </>
                  ) : (
                    "Continuar"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
