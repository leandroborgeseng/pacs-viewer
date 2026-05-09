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

  function fullscreenActive() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  function exitFullscreen() {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(function () {});
    } else if (document.webkitExitFullscreen) {
      try {
        document.webkitExitFullscreen();
      } catch (_e) {}
    }
  }

  function requestFullscreen() {
    var root = document.documentElement;
    var p = root.requestFullscreen && root.requestFullscreen();
    if (p && typeof p.then === "function") {
      p.catch(function () {});
    } else if (root.webkitRequestFullscreen) {
      try {
        root.webkitRequestFullscreen();
      } catch (_e) {}
    }
  }

  function syncFullscreenButton() {
    var fsBtn = document.querySelector("[data-bb-fs]");
    if (!fsBtn) return;
    var on = fullscreenActive();
    fsBtn.setAttribute("aria-pressed", on ? "true" : "false");
    fsBtn.textContent = on ? "Sair ecrã cheio" : "Ecrã cheio";
  }

  function wireFullscreenButton(btn) {
    if (!btn || btn.dataset.bbFsWired === "1") return;
    btn.dataset.bbFsWired = "1";
    btn.addEventListener("click", function () {
      if (fullscreenActive()) exitFullscreen();
      else requestFullscreen();
    });
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
    var n = state.user.name || "Utilizador";
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
      '<button type="button" class="bb-chrome-fs" data-bb-fs aria-pressed="false" title="Alternar ecrã completo">Ecrã cheio</button>' +
      '<button type="button" class="bb-chrome-logout" data-bb-logout>Sair</button>' +
      "</div>";
    wireFullscreenButton(el.querySelector("[data-bb-fs]"));
    syncFullscreenButton();
    var btn = el.querySelector("[data-bb-logout]");
    if (btn) {
      btn.addEventListener("click", function () {
        try {
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage(
              { source: "bb-viewer", type: "BB_LOGOUT", ts: Date.now() },
              window.location.origin,
            );
          } else if (window.parent && window.parent !== window) {
            window.parent.postMessage(
              { source: "bb-viewer", type: "BB_LOGOUT", ts: Date.now() },
              window.location.origin,
            );
          }
        } catch (_e) {}
        try {
          window.close();
        } catch (_e2) {}
        setTimeout(function () {
          try {
            window.location.href = new URL("/login", window.location.origin).href;
          } catch (_e3) {}
        }, 200);
      });
    }
  }

  document.addEventListener("fullscreenchange", syncFullscreenButton);
  document.addEventListener("webkitfullscreenchange", syncFullscreenButton);

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
    } catch (_e) {}
  });
})();
