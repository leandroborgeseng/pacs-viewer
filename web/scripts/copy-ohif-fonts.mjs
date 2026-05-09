#!/usr/bin/env node
/**
 * Copia ficheiros woff2 do @fontsource-variable/montserrat para public/ohif/fonts/
 * (sem pedidos a fonts.googleapis.com no viewer OHIF).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgFonts = path.join(
  __dirname,
  "..",
  "node_modules",
  "@fontsource-variable",
  "montserrat",
  "files",
);
const publicOhif = path.join(__dirname, "..", "public", "ohif");
const destDir = path.join(publicOhif, "fonts");

const FILES = [
  "montserrat-latin-wght-normal.woff2",
  "montserrat-latin-ext-wght-normal.woff2",
];

export function copyOhifFonts() {
  if (!fs.existsSync(pkgFonts)) {
    console.warn(
      "[ohif-fonts] node_modules/@fontsource-variable/montserrat em falta — corra npm ci na pasta web.",
    );
    return false;
  }
  if (!fs.existsSync(path.join(publicOhif, "index.html"))) {
    console.warn("[ohif-fonts] public/ohif sem build OHIF — ignorado.");
    return false;
  }
  fs.mkdirSync(destDir, { recursive: true });
  for (const f of FILES) {
    const src = path.join(pkgFonts, f);
    if (!fs.existsSync(src)) {
      console.warn("[ohif-fonts] em falta:", f);
      continue;
    }
    fs.copyFileSync(src, path.join(destDir, f));
  }
  console.log("[ohif-fonts] →", destDir);
  return true;
}
