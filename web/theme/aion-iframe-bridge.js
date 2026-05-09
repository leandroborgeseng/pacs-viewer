/**
 * Ponte Aion: recebe dados de sessão do portal (postMessage) e oferece logout
 * que delega ao parent. Mesma origem apenas.
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

  function render() {
    var el = document.getElementById("aion-iframe-chrome");
    if (!el) {
      el = document.createElement("div");
      el.id = "aion-iframe-chrome";
      el.setAttribute("role", "complementary");
      el.setAttribute("aria-label", "Aion Imaging — sessão");
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
      '<div class="aion-chrome-inner">' +
      '<div class="aion-chrome-avatar" title="' +
      esc(e) +
      '">' +
      esc(initials(n)) +
      "</div>" +
      '<div class="aion-chrome-meta">' +
      '<span class="aion-chrome-name">' +
      esc(n) +
      "</span>" +
      '<span class="aion-chrome-role">' +
      esc(r) +
      "</span>" +
      "</div>" +
      '<button type="button" class="aion-chrome-logout" data-aion-logout>Sair</button>' +
      "</div>";
    var btn = el.querySelector("[data-aion-logout]");
    if (btn) {
      btn.addEventListener("click", function () {
        try {
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage(
              { source: "aion-iframe", type: "AION_LOGOUT", ts: Date.now() },
              window.location.origin,
            );
          } else if (window.parent && window.parent !== window) {
            window.parent.postMessage(
              { source: "aion-iframe", type: "AION_LOGOUT", ts: Date.now() },
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

  window.addEventListener("message", function (ev) {
    try {
      if (ev.origin !== window.location.origin) return;
      var d = ev.data;
      if (!d || typeof d !== "object") return;
      if (d.source !== "aion-parent") return;
      if (d.type === "SESSION") {
        state.user = d.user || null;
        render();
      }
    } catch (_e) {}
  });
})();
