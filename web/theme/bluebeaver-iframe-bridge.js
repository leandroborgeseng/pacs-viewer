/**
 * BlueBeaver — ponte com o portal (postMessage, mesma origem).
 */
(function () {
  "use strict";

  var state = { user: null };

  function esc(s) {
    if (s == null || s === "") return "";
    var d = document.createElement("div");
    d.textContent = String(s);
    return d.innerHTML;
  }

  function initials(name) {
    if (!name) return "?";
    var p = String(name).trim().split(/\s+/).filter(Boolean);
    if (p.length >= 2) return (p[0][0] + p[1][0]).toUpperCase();
    return String(name).slice(0, 2).toUpperCase();
  }

  function exitFullscreen() {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(function () {});
    } else if (document.webkitExitFullscreen) {
      try {
        document.webkitExitFullscreen();
      } catch {
        /* ignore */
      }
    }
  }

  function render() {
    var el = document.getElementById("bb-viewer-chrome");
    if (!el) {
      el = document.createElement("div");
      el.id = "bb-viewer-chrome";
      el.setAttribute("role", "complementary");
      el.setAttribute("aria-label", "BlueBeaver — sessão");
      document.body.appendChild(el);
    }
    if (!state.user) {
      el.innerHTML = "";
      el.hidden = true;
      return;
    }
    el.hidden = false;
    var n = state.user.name || "Usuário";
    var e = state.user.email || "";
    var r = state.user.role || "";
    el.innerHTML =
      '<div class="bb-chrome-inner">' +
      '<div class="bb-chrome-avatar" title="' +
      esc(e) +
      '">' +
      esc(initials(n)) +
      "</div>" +
      '<div class="bb-chrome-meta">' +
      '<span class="bb-chrome-name">' +
      esc(n) +
      "</span>" +
      '<span class="bb-chrome-role">' +
      esc(r) +
      "</span>" +
      "</div>" +
      '<button type="button" class="bb-chrome-fechar" data-bb-fechar title="Fechar o leitor (sem encerrar a sessão no portal)">Fechar</button>' +
      "</div>";
    var btn = el.querySelector("[data-bb-fechar]");
    if (btn) {
      btn.addEventListener("click", function () {
        exitFullscreen();
        try {
          window.close();
        } catch {
          /* ignore */
        }
      });
    }
  }

  window.addEventListener("message", function (ev) {
    try {
      if (ev.origin !== window.location.origin) return;
      var d = ev.data;
      if (!d || typeof d !== "object") return;
      if (d.source !== "bb-portal") return;
      if (d.type === "SESSION") {
        state.user = d.user || null;
        render();
      }
    } catch {
      /* ignore */
    }
  });

  /** OHIF cabeça paciente: labels em inglês quando colapsado (ex.: vários pacientes); traduz sem dependência de fork OHIF */
  function localizePatientCollapsedLabels() {
    try {
      var nodes = document.querySelectorAll("div.text-primary-active.self-center");
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        if (el.children.length > 0) continue;
        var t = String(el.textContent || "").trim();
        if (t === "Patient") el.textContent = "Paciente";
        else if (t === "Multiple Patients") el.textContent = "Vários pacientes";
      }
    } catch {
      /* ignore */
    }
  }
  var _locTz;
  function scheduleLocalize() {
    clearTimeout(_locTz);
    _locTz = setTimeout(localizePatientCollapsedLabels, 40);
  }
  try {
    var mo = new MutationObserver(scheduleLocalize);
    function startObserve() {
      if (!document.body) return;
      mo.observe(document.body, { subtree: true, childList: true, characterData: true });
      scheduleLocalize();
    }
    if (document.body) startObserve();
    else document.addEventListener("DOMContentLoaded", startObserve, { once: true });
  } catch {
    /* ignore */
  }
})();
