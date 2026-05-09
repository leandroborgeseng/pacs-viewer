"use client";

import { Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOnlineStatus } from "@/hooks/use-online-status";

type Props = { className?: string };

export function ConnectionPill({ className }: Props) {
  const online = useOnlineStatus();

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        online
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          : "border-amber-500/30 bg-amber-500/10 text-amber-300",
        className,
      )}
      title={online ? "Ligação de rede activa" : "Sem ligação de rede"}
    >
      {online ? <Wifi className="size-3.5" aria-hidden /> : <WifiOff className="size-3.5" aria-hidden />}
      {online ? "Online" : "Offline"}
    </span>
  );
}
