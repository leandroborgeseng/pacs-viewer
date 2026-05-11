#!/usr/bin/env node
/**
 * Gera public/ohif/app-config.js após copiar o build estático do OHIF.
 *
 * O data source DICOMweb usa **mesma origem** que o portal: `origin + /bb-api/dicomweb`.
 * O Route Handler `src/app/bb-api/dicomweb/[[...path]]/route.ts` faz proxy para `NEXT_PUBLIC_API_URL/dicomweb`
 * preservando Authorization (rewrite em next.config omitia Bearer e causava 401).
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
    maxNumRequests: {
      interaction: 120,
      thumbnail: 80,
      prefetch: 30,
    },
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
              flexDirection: "row",
              alignItems: "center",
              gap: "12px",
              marginLeft: "8px",
              fontFamily:
                '"Montserrat Variable", Montserrat, ui-sans-serif, system-ui, sans-serif',
            },
          },
          React.createElement(
            "div",
            {
              "aria-hidden": true,
              style: {
                width: "38px",
                height: "38px",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: "13px",
                letterSpacing: "-0.04em",
                color: "#f8fafc",
                border: "1px solid rgba(46,177,0,0.35)",
                background:
                  "linear-gradient(148deg,#0066b2 0%,#084a82 52%,#0a3d54 100%)",
                boxShadow:
                  "0 0 0 1px rgba(0,0,0,.25), 0 6px 20px rgba(0,102,178,0.25)",
              },
            },
            "BB"
          ),
          React.createElement(
            "div",
            {
              style: {
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                lineHeight: 1.2,
              },
            },
            React.createElement(
              "span",
              {
                style: {
                  fontWeight: 700,
                  fontSize: "16px",
                  color: "#F1F5F9",
                  letterSpacing: "-0.035em",
                },
              },
              "BlueBeaver"
            ),
            React.createElement(
              "span",
              {
                style: {
                  fontSize: "10px",
                  color: "#9fe86b",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.09em",
                },
              },
              "Leitor DICOM institucional"
            )
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
                var token =
                  params.get("access_token") ||
                  params.get("token") ||
                  (typeof localStorage !== "undefined"
                    ? localStorage.getItem("portal_token")
                    : null);
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
