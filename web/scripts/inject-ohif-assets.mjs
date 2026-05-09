#!/usr/bin/env node
/**
 * Injeta CSS + bridge JS BlueBeaver no build estático do OHIF.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicOhif = path.join(__dirname, "..", "public", "ohif");
const indexPath = path.join(publicOhif, "index.html");
const cssSrc = path.join(__dirname, "..", "theme", "bluebeaver-ohif.css");
const cssDest = path.join(publicOhif, "bluebeaver-ohif.css");
const jsSrc = path.join(__dirname, "..", "theme", "bluebeaver-iframe-bridge.js");
const jsDest = path.join(publicOhif, "bluebeaver-iframe-bridge.js");

const MARKER_HEAD = "<!-- bluebeaver-ohif-assets -->";
const MARKER_BODY = "<!-- bluebeaver-ohif-bridge -->";

if (!fs.existsSync(indexPath)) {
  console.warn("[bluebeaver-ohif] sem index.html em public/ohif — ignorado.");
  process.exit(0);
}

for (const [src, dest, label] of [
  [cssSrc, cssDest, "bluebeaver-ohif.css"],
  [jsSrc, jsDest, "bluebeaver-iframe-bridge.js"],
]) {
  if (!fs.existsSync(src)) {
    console.error("[bluebeaver-ohif] falta", label);
    process.exit(1);
  }
  fs.copyFileSync(src, dest);
}

let html = fs.readFileSync(indexPath, "utf8");
let changed = false;

if (!html.includes(MARKER_HEAD)) {
  const link = `${MARKER_HEAD}
<link rel="stylesheet" href="./bluebeaver-ohif.css" crossorigin="anonymous" />`;
  if (!html.includes("</head>")) {
    console.error("[bluebeaver-ohif] index.html sem </head>");
    process.exit(1);
  }
  html = html.replace("</head>", `${link}\n</head>`);
  changed = true;
}

if (!html.includes(MARKER_BODY)) {
  const script = `${MARKER_BODY}
<script src="./bluebeaver-iframe-bridge.js" defer crossorigin="anonymous"></script>`;
  if (html.includes("</body>")) {
    html = html.replace("</body>", `${script}\n</body>`);
  } else {
    html += `\n${script}\n`;
  }
  changed = true;
}

if (changed) {
  fs.writeFileSync(indexPath, html, "utf8");
  console.log("[bluebeaver-ohif] inject atualizado em public/ohif/index.html");
} else {
  console.log("[bluebeaver-ohif] inject completo. Ficheiros copiados.");
}
