import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  size?: "sm" | "md" | "lg";
};

const sizeMap = { sm: "size-9 text-xs", md: "size-11 text-sm", lg: "size-14 text-base" };

/** Logótipo compacto Aion Imaging (marca textual + gradiente). */
export function AionLogoMark({ className, size = "md" }: Props) {
  return (
    <div
      className={cn(
        "grid place-items-center rounded-2xl bg-gradient-to-br font-bold tracking-tight text-white shadow-lg ring-1 ring-white/10",
        "from-[#0066B2] to-[#004a82]",
        sizeMap[size],
        className,
      )}
      aria-hidden
    >
      AI
    </div>
  );
}
