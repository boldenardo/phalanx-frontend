/* ===== PHALANX ADMIN DASHBOARD ===== */
(function () {
  "use strict";

  const PK = window.PHALANX_CLERK_PK || "";
  if (!PK) {
    document.body.innerHTML =
      '<div style="padding:4rem;text-align:center;color:#ff6b6b;font-family:Fira Code,monospace">CLERK_PUBLISHABLE_KEY ausente.</div>';
    return;
  }

  let clerk = null;

  function loadClerk() {
    return new Promise((resolve, reject) => {
      const host = (function () {
        try {
          const body = PK.split("_").slice(2).join("_").replace(/\$+$/, "");
          return atob(body + "===".slice((body.length + 3) % 4)).replace(
            /\$+$/,
            "",
          );
        } catch (e) {
          return "";
        }
      })();
      if (!host) return reject(new Error("PK invalida"));
      const s = document.createElement("script");
      s.src = `https://${host}/npm/@clerk/clerk-js@5/dist/clerk.browser.js`;
      s.async = true;
      s.crossOrigin = "anonymous";
      s.setAttribute("data-clerk-publishable-key", PK);
      s.onload = () => resolve(window.Clerk);
      s.onerror = () => reject(new Error("falha carregando Clerk"));
      document.head.appendChild(s);
    });
  }

  async function authHeaders() {
    const token = await clerk.session?.getToken();
    return token ? { Authorization: "Bearer " + token } : {};
  }

  async function apiGet(path) {
    const r = await fetch(path, { headers: await authHeaders() });
    const data = await r.json().catch(() => ({}));
    if (!r.ok)
      throw Object.assign(new Error(data.error || "HTTP " + r.status), {
        status: r.status,
        data,
      });
    return data;
  }

  function fmtNum(n) {
    return Number(n || 0).toLocaleString("pt-BR");
  }

  function fmtTime(ts) {
    if (!ts) return "--";
    return new Date(ts * 1000).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function byName(rows, name) {
    const row = (rows || []).find((item) => item.event_name === name);
    return Number(row?.total || 0);
  }

  function render(data) {
    const t = data.totals || {};
    document.getElementById("kSessions").textContent = fmtNum(t.sessions);
    document.getElementById("kClicks").textContent = fmtNum(t.clicks);
    document.getElementById("kScans").textContent = fmtNum(
      t.scans_completed || t.scan_submits,
    );
    document.getElementById("kLeads").textContent = fmtNum(
      t.leads || t.lead_submits,
    );
    document.getElementById("kConv").textContent =
      (t.conversion_rate || 0) + "%";

    const funnelItems = [
      ["Page views", byName(data.funnel, "page_view") || t.sessions],
      ["Hero scans", byName(data.funnel, "hero_scan_submit")],
      ["Scans pedidos", byName(data.funnel, "scan_submit")],
      ["Planos clicados", byName(data.funnel, "plan_click")],
      ["Leads", t.leads || byName(data.funnel, "lead_submit")],
    ];
    const max = Math.max(...funnelItems.map(([, v]) => v), 1);
    document.getElementById("funnel").innerHTML = funnelItems
      .map(
        ([label, value]) => `
      <div class="funnel-step">
        <span>${esc(label)}</span>
        <b>${fmtNum(value)}</b>
        <small>${Math.round((value / max) * 100)}% do topo</small>
        <i class="funnel-fill" style="width:${Math.max(4, (value / max) * 100)}%"></i>
      </div>
    `,
      )
      .join("");

    const clicks = data.top_clicks || [];
    document.getElementById("topClicks").innerHTML = clicks.length
      ? clicks
          .map(
            (row) => `
      <div class="rank-row"><b>${esc(row.element)}</b><span>${fmtNum(row.total)}</span></div>
    `,
          )
          .join("")
      : '<p class="muted-line">Sem cliques registrados ainda.</p>';

    document.getElementById("insights").innerHTML = buildInsights(
      t,
      funnelItems,
    )
      .map(
        (text) => `
      <div class="insight-row"><i class="fas fa-arrow-trend-up"></i><p>${esc(text)}</p></div>
    `,
      )
      .join("");

    const timeline = data.timeline || [];
    document.getElementById("timeline").innerHTML = timeline.length
      ? timeline
          .map(
            (event) => `
      <div class="event-row">
        <small>${fmtTime(event.created_at)}</small>
        <b>${esc(event.event_name)}</b>
        <em>${esc(event.element || event.path || "--")}</em>
        <span>${esc(event.path || "")}</span>
      </div>
    `,
          )
          .join("")
      : '<p class="muted-line">Sem eventos recentes.</p>';
  }

  function buildInsights(t, funnelItems) {
    const sessions = Number(t.sessions || 0);
    const leads = Number(t.leads || t.lead_submits || 0);
    const scans = Number(t.scans_completed || t.scan_submits || 0);
    const clicks = Number(t.clicks || 0);
    const out = [];
    if (!sessions)
      return [
        "Assim que a landing receber trafego, este painel aponta gargalos e oportunidades.",
      ];
    if (scans && !leads)
      out.push(
        "Tem gente levantando a mao no scan, mas nao virando lead. Coloque uma CTA direta no resultado: 'receber plano de correcao no WhatsApp'.",
      );
    if (clicks > sessions * 3 && leads < sessions * 0.02)
      out.push(
        "Muitos cliques e pouca conversao: reduza escolhas acima da dobra e venda uma unica proxima acao.",
      );
    if (leads / sessions >= 0.05)
      out.push(
        "Conversao acima de 5%. O proximo movimento e comprar trafego para a promessa que ja provou tracao.",
      );
    if (!out.length)
      out.push(
        "Ainda falta volume. Leve 100 visitantes qualificados antes de mudar preco, oferta ou headline.",
      );
    out.push(
      "Score medio dos scans: " +
        fmtNum(t.avg_scan_score) +
        ". Use os piores diagnosticos como prova real de venda.",
    );
    return out.slice(0, 4);
  }

  async function loadData() {
    const days = document.getElementById("rangeDays").value;
    const data = await apiGet(
      "/api/analytics/summary?days=" + encodeURIComponent(days),
    );
    render(data);
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(
      /[&<>\"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
    );
  }

  async function boot() {
    try {
      await loadClerk();
    } catch (e) {
      document.body.innerHTML =
        '<div style="padding:4rem;text-align:center;color:#ff6b6b;font-family:Fira Code,monospace">Falha carregando Clerk: ' +
        esc(e.message) +
        "</div>";
      return;
    }
    clerk = window.Clerk;
    await clerk.load();

    async function renderAuth() {
      const signedOut = document.getElementById("signedOut");
      const signedIn = document.getElementById("signedIn");
      const forbidden = document.getElementById("forbidden");
      const userArea = document.getElementById("userArea");
      if (!clerk.user) {
        signedOut.hidden = false;
        signedIn.hidden = true;
        forbidden.hidden = true;
        userArea.innerHTML = "";
        const target = document.getElementById("clerkSignIn");
        target.innerHTML = "";
        clerk.mountSignIn(target, {
          afterSignInUrl: "/admin",
          afterSignUpUrl: "/admin",
          appearance: authAppearance(),
        });
        return;
      }

      signedOut.hidden = true;
      userArea.innerHTML = "<span></span>";
      clerk.mountUserButton(userArea.querySelector("span"));
      try {
        await apiGet(
          "/api/analytics/summary?days=" +
            encodeURIComponent(document.getElementById("rangeDays").value),
        );
        forbidden.hidden = true;
        signedIn.hidden = false;
        await loadData();
      } catch (e) {
        signedIn.hidden = true;
        forbidden.hidden = e.status !== 401 ? false : true;
      }
    }

    document
      .getElementById("refreshBtn")
      .addEventListener("click", () =>
        loadData().catch((e) => alert("Erro: " + e.message)),
      );
    document
      .getElementById("rangeDays")
      .addEventListener("change", () => loadData().catch(() => {}));
    await renderAuth();
    clerk.addListener(renderAuth);
  }

  function authAppearance() {
    return {
      variables: {
        colorPrimary: "#ff6711",
        colorText: "#101820",
        colorBackground: "#fffdfa",
        colorInputBackground: "#fffbf6",
        colorInputText: "#101820",
        borderRadius: "10px",
        fontFamily: "AventaLight, Tajawal, sans-serif",
      },
      elements: {
        card: "phalanx-clerk-card",
        headerTitle: "phalanx-clerk-title",
        formButtonPrimary: "phalanx-clerk-button",
        socialButtonsBlockButton: "phalanx-clerk-social",
        footerActionLink: "phalanx-clerk-link",
      },
    };
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
