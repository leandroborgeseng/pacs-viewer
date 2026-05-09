"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Moon, Sun, LogOut, LayoutDashboard, Images, Shield } from "lucide-react";
import { useTheme } from "next-themes";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/context/auth-context";
import { BlueBeaverLogo } from "@/components/branding/bluebeaver-logo";
import { ConnectionPill } from "@/components/branding/connection-pill";
import { KeyboardShortcutsSheet } from "@/components/branding/keyboard-shortcuts-sheet";

const nav = [
  { href: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { href: "/exames", label: "Exames", icon: Images },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (!user?.role) {
      document.documentElement.removeAttribute("data-bb-role");
      return;
    }
    document.documentElement.setAttribute("data-bb-role", user.role);
    return () => document.documentElement.removeAttribute("data-bb-role");
  }, [user?.role]);

  return (
    <div
      className={cn(
        "bb-app-root min-h-screen bg-background",
        "bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(0,102,178,0.12),transparent),radial-gradient(ellipse_100%_50%_at_100%_0%,rgba(46,177,0,0.07),transparent)]",
        user?.role === "PACIENTE" &&
          "bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(0,102,178,0.1),transparent),radial-gradient(ellipse_90%_55%_at_0%_0%,rgba(46,177,0,0.11),transparent)]",
      )}
    >
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex h-[52px] max-w-[1600px] items-center justify-between gap-4 px-4 md:px-6">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
            <BlueBeaverLogo size="sm" className="max-h-9" />
            <div className="min-w-0 leading-tight hidden sm:block">
              <p className="truncate text-sm font-semibold tracking-tight">BlueBeaver</p>
              <p className="truncate text-[11px] text-muted-foreground">Imagiologia clínica</p>
            </div>
          </Link>
          <nav className="hidden flex-1 items-center justify-center gap-1 md:flex">
            {nav.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    buttonVariants({
                      variant: active ? "secondary" : "ghost",
                      size: "sm",
                    }),
                    "gap-2",
                  )}
                >
                  <item.icon className="size-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
            {user?.role === "ADMIN" && (
              <Link
                href="/admin"
                className={cn(
                  buttonVariants({
                    variant: pathname.startsWith("/admin") ? "secondary" : "ghost",
                    size: "sm",
                  }),
                  "gap-2",
                )}
              >
                <Shield className="size-4 shrink-0" />
                Administração
              </Link>
            )}
          </nav>
          <div className="flex items-center gap-1 sm:gap-2">
            <ConnectionPill className="hidden sm:inline-flex" />
            <KeyboardShortcutsSheet />
            <Button
              variant="ghost"
              size="icon"
              className="relative shrink-0"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Alternar tema"
            >
              <Sun className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
              <Moon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "h-9 gap-2 border-border/80 bg-card/50 px-2 backdrop-blur-sm",
                )}
              >
                <Avatar className="size-7">
                  <AvatarFallback className="bg-primary/15 text-xs font-medium text-primary">
                    {user?.name?.slice(0, 2).toUpperCase() ?? "--"}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden max-w-[120px] truncate text-sm sm:inline">{user?.name}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Perfil: {user?.role}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    logout();
                    router.push("/login");
                  }}
                >
                  <LogOut className="size-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] px-4 py-6 md:px-6 md:py-8">{children}</main>
    </div>
  );
}
