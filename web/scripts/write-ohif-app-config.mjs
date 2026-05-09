#!/usr/bin/env node
/**
 * Gera public/ohif/app-config.js após copiar o build estático do OHIF.
 *
 * O data source DICOMweb usa **mesma origem** que o portal: `origin + /bb-api/dicomweb`.
 * O Next reescreve isso para `NEXT_PUBLIC_API_URL/dicomweb` (ver next.config.ts),
 * evitando CORS/CSP no browser e URLs da API incorrectas no bundle estático.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicOhif = path.join(__dirname, "..", "public", "ohif");
const configPath = path.join(publicOhif, "app-config.js");

const apiBase =
  process.env.MEDVIEW_API_BASE ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:3001/api";
const normalized = String(apiBase).replace(/\/$/, "");

const src = `/* gerado por scripts/write-ohif-app-config.mjs — não editar em CI */
(function () {
  var _origin = "";
  try {
    _origin =
      typeof window !== "undefined" && window.location && window.location.origin
        ? window.location.origin
        : "";
  } catch (_e) {}
  /** Proxy same-origin (Next → API). Não usar URL absoluta do PACS aqui. */
  var dicomRoot = _origin + "/bb-api/dicomweb";
  window.config = {
    routerBasename: "/ohif",
    extensions: [],
    modes: [],
    customizationService: {},
    showStudyList: true,
    maxNumberOfWebWorkers: 3,
    groupEnabledModesFirst: true,
    showLoadingIndicator: true,
    showCPUFallbackMessage: true,
    strictZSpacingForVolumeViewport: true,
    showWarningMessageForCrossOrigin: false,
    investigationalUseDialog: { option: "never" },
    showPatientInfo: "visibleCollapsed",
    whiteLabeling: {
      createLogoComponentFn: function (React) {
        return React.createElement(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              marginLeft: "10px",
              fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif",
            },
          },
          React.createElement(
            "span",
            {
              style: {
                fontWeight: 700,
                fontSize: "15px",
                color: "#E5E7EB",
                letterSpacing: "-0.03em",
                lineHeight: 1.15,
              },
            },
            "BlueBeaver"
          ),
          React.createElement(
            "span",
            {
              style: {
                fontSize: "10px",
                color: "#7ae632",
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
              },
            },
            "Enterprise Viewer"
          )
        );
      },
    },
    httpErrorHandler: function (error) {
      if (error && error.status) {
        console.warn("[BlueBeaver] DICOMweb", error.status);
      }
    },
    defaultDataSourceName: "dicomweb",
    dataSources: [
      {
        namespace: "@ohif/extension-default.dataSourcesModule.dicomweb",
        sourceName: "dicomweb",
        configuration: {
          friendlyName: "BlueBeaver — PACS",
          name: "bluebeaver",
          wadoUriRoot: dicomRoot,
          qidoRoot: dicomRoot,
          wadoRoot: dicomRoot,
          qidoSupportsIncludeField: false,
          imageRendering: "wadors",
          thumbnailRendering: "wadors",
          enableStudyLazyLoad: true,
          supportsFuzzyMatching: false,
          supportsWildcard: true,
          singlepart: "bulkdata,video,pdf",
          requestOptions: {
            auth: function (xhr) {
              try {
                var params = new URLSearchParams(window.location.search);
                var token = params.get("access_token") || params.get("token");
                if (token) {
                  xhr.setRequestHeader("Authorization", "Bearer " + token);
                }
              } catch (_e) {
                /* ignore */
              }
            },
          },
        },
      },
    ],
  };
  if (typeof window !== "undefined" && window.location.hash === "#patient") {
    window.config = Object.assign({}, window.config, { showStudyList: false });
  }
})();
`;

fs.mkdirSync(publicOhif, { recursive: true });
fs.writeFileSync(configPath, src, "utf8");
console.log("[ohif] app-config.js ->", configPath);
console.log("[ohif] browser dicomRoot = <origin>/bb-api/dicomweb → proxy →", `${normalized}/dicomweb`);
