"use client";

import { Keyboard } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const PORTAL_ROWS: { action: string; key: string }[] = [
  { action: "Navegar no portal", key: "Rato / teclado padrão" },
  { action: "Alternar tema claro/escuro", key: "Ícone lua/sol (topo)" },
  { action: "Abrir visualizador DICOM", key: "Exames → Abrir estudo" },
];

const VIEWER_NOTE =
  "No visualizador DICOM (janela dedicada), os atalhos seguem a configuração OHIF: preferências no menu de definições (ícone de engrenagem) dentro do viewer.";

export function KeyboardShortcutsSheet() {
  return (
    <Sheet>
        <SheetTrigger
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "shrink-0",
          )}
          aria-label="Atalhos do portal"
        >
          <Keyboard className="size-4" />
        </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Atalhos e ajuda</SheetTitle>
          <SheetDescription>
            Resumo rápido do portal BlueBeaver. O leitor de imagens usa atalhos próprios (cornerstone).
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Portal
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Acção</TableHead>
                <TableHead className="text-right">Como</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PORTAL_ROWS.map((row) => (
                <TableRow key={row.action}>
                  <TableCell className="text-sm">{row.action}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">{row.key}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{VIEWER_NOTE}</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
