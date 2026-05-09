#!/usr/bin/env node
/**
 * Injeta CSS + bridge JS do Aion no build estático do OHIF.
 * Idempotente: pode voltar a correr para adicionar marca(s) em falta.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicOhif = path.join(__dirname, "..", "public", "ohif");
const indexPath = path.join(publicOhif, "index.html");
const cssSrc = path.join(__dirname, "..", "theme", "aion-ohif.css");
const cssDest = path.join(publicOhif, "aion-ohif.css");
const jsSrc = path.join(__dirname, "..", "theme", "aion-iframe-bridge.js");
const jsDest = path.join(publicOhif, "aion-iframe-bridge.js");

const MARKER_HEAD = "<!-- aion-ohif-assets -->";
const MARKER_BODY = "<!-- aion-ohif-bridge -->";

if (!fs.existsSync(indexPath)) {
  console.warn("[aion-ohif] sem index.html em public/ohif — ignorado (normal em dev sem Docker).");
  process.exit(0);
}

for (const [src, dest, label] of [
  [cssSrc, cssDest, "aion-ohif.css"],
  [jsSrc, jsDest, "aion-iframe-bridge.js"],
]) {
  if (!fs.existsSync(src)) {
    console.error("[aion-ohif] falta", label);
    process.exit(1);
  }
  fs.copyFileSync(src, dest);
}

let html = fs.readFileSync(indexPath, "utf8");
let changed = false;

if (!html.includes(MARKER_HEAD)) {
  const link = `${MARKER_HEAD}
<link rel="stylesheet" href="./aion-ohif.css" crossorigin="anonymous" />`;
  if (!html.includes("</head>")) {
    console.error("[aion-ohif] index.html sem </head>");
    process.exit(1);
  }
  html = html.replace("</head>", `${link}\n</head>`);
  changed = true;
}

if (!html.includes(MARKER_BODY)) {
  const script = `${MARKER_BODY}
<script src="./aion-iframe-bridge.js" defer crossorigin="anonymous"></script>`;
  if (html.includes("</body>")) {
    html = html.replace("</body>", `${script}\n</body>`);
  } else {
    html += `\n${script}\n`;
  }
  changed = true;
}

if (changed) {
  fs.writeFileSync(indexPath, html, "utf8");
  console.log("[aion-ohif] inject atualizado em public/ohif/index.html");
} else {
  console.log("[aion-ohif] inject já completo (CSS + bridge). Ficheiros copiados.");
}
