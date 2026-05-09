import Image from "next/image";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

const dims: Record<Size, { w: number; h: number }> = {
  sm: { w: 132, h: 36 },
  md: { w: 158, h: 42 },
  lg: { w: 200, h: 52 },
};

export function BlueBeaverLogo({
  size = "md",
  className,
  priority,
}: {
  size?: Size;
  className?: string;
  /** Login LCP: marcar como prioritário */
  priority?: boolean;
}) {
  const { w, h } = dims[size];
  return (
    <Image
      src="/branding/bluebeaver-logo.png"
      alt="BlueBeaver"
      width={w}
      height={h}
      priority={priority}
      className={cn("h-auto max-w-[min(100%,240px)] object-contain object-left", className)}
      sizes="(max-width:640px) 140px, 200px"
    />
  );
}
