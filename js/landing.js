/* ===== PHALANX LANDING - main script ===== */
(function () {
  "use strict";

  // -------------------------------------------------------- Matrix canvas
  function initMatrix() {
    const canvas = document.getElementById("matrixCanvas");
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      canvas.hidden = true;
      return;
    }
    const ctx = canvas.getContext("2d");
    const chars = "PHALANXARKKHE01".split("");
    const targetFps = window.innerWidth < 700 ? 8 : 12;
    const frameMs = 1000 / targetFps;
    let cols,
      drops,
      lastFrame = 0,
      running = true;
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      const width = canvas.parentElement.offsetWidth;
      const height = canvas.parentElement.offsetHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.floor(canvas.width / 16);
      drops = Array(cols).fill(1);
    }
    resize();
    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", () => {
      running = !document.hidden;
    });
    function draw(now) {
      requestAnimationFrame(draw);
      if (!running || now - lastFrame < frameMs) return;
      lastFrame = now;
      ctx.fillStyle = "rgba(255,253,250,0.08)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(255,103,17,0.16)";
      ctx.font = '12px "SFMono-Regular", Consolas, monospace';
      for (let i = 0; i < cols; i++) {
        const ch = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(ch, i * 16, drops[i] * 16);
        if (drops[i] * 16 > canvas.height && Math.random() > 0.975)
          drops[i] = 0;
        drops[i]++;
      }
    }
    requestAnimationFrame(draw);
  }

  // -------------------------------------------------------- Stats counter
  function animateCounters() {
    const els = document.querySelectorAll("[data-count]");
    els.forEach((el) => {
      const target = parseInt(el.getAttribute("data-count"), 10);
      const dur = 1400;
      const t0 = performance.now();
      function tick(now) {
        const k = Math.min(1, (now - t0) / dur);
        const eased = 1 - Math.pow(1 - k, 3);
        el.textContent = Math.round(target * eased);
        if (k < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  // -------------------------------------------------------- API helpers
  async function postJSON(path, body) {
    const r = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const err = new Error(data.error || "HTTP " + r.status);
      err.detail = data;
      throw err;
    }
    return data;
  }

  const SESSION_KEY = "phalanx_session_id";
  function sessionId() {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id =
        "px_" +
        Date.now().toString(36) +
        "_" +
        Math.random().toString(36).slice(2, 10);
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  }

  function track(eventName, payload) {
    const body = JSON.stringify({
      session_id: sessionId(),
      event_name: eventName,
      path: location.pathname + location.search,
      referrer: document.referrer || "",
      ...payload,
    });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          "/api/analytics/event",
          new Blob([body], { type: "application/json" }),
        );
        return;
      }
    } catch (_) {}
    fetch("/api/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  }

  function labelFor(el) {
    return (
      el.getAttribute("data-track") ||
      el.getAttribute("aria-label") ||
      el.textContent ||
      el.getAttribute("href") ||
      el.id ||
      el.className ||
      "elemento"
    )
      .toString()
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160);
  }

  // -------------------------------------------------------- Hero scan -> jump to scan section
  document.getElementById("heroScan")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const url = document.getElementById("heroUrl").value.trim();
    if (!url) return;
    track("hero_scan_submit", { element: "hero_scan", details: { url } });
    document.getElementById("scanUrl").value = url;
    document.getElementById("scan").scrollIntoView({ behavior: "smooth" });
    setTimeout(() => document.getElementById("scanForm").requestSubmit(), 400);
  });

  // -------------------------------------------------------- Scan form
  function fmtMs(v) {
    if (v == null) return "—";
    if (v < 1000) return Math.round(v) + " ms";
    return (v / 1000).toFixed(2) + " s";
  }
  function fmtBytes(n) {
    if (!n) return "—";
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / 1024 / 1024).toFixed(2) + " MB";
  }
  function setScore(numEl, barEl, value) {
    const v = Math.max(0, Math.min(100, value || 0));
    numEl.textContent = v;
    barEl.style.width = v + "%";
    barEl.classList.remove("danger", "warn");
    if (v < 40) barEl.classList.add("danger");
    else if (v < 70) barEl.classList.add("warn");
  }

  function showScanError(message) {
    const result = document.getElementById("scanResult");
    const summary = document.getElementById("aiSummary");
    if (!result || !summary) {
      alert("Falha no scan: " + message);
      return;
    }
    result.hidden = false;
    summary.textContent =
      "Falha no scan: " +
      message +
      ". Verifique se a URL tem dominio valido e tente novamente.";
    ["perfList", "secList", "mapList", "vulnList"].forEach((id) => {
      const node = document.getElementById(id);
      if (node)
        node.innerHTML = '<p class="muted-line">Sem dados neste teste.</p>';
    });
    ["scoreTotal", "scorePerf", "scoreSec", "scoreVuln"].forEach((id) => {
      const node = document.getElementById(id);
      if (node) node.textContent = "--";
    });
    result.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showScanLimit(detail) {
    const result = document.getElementById("scanResult");
    const summary = document.getElementById("aiSummary");
    if (!result || !summary) return;
    result.hidden = false;
    summary.innerHTML =
      "<strong>Seu scan gratuito de hoje já foi usado.</strong> Entre na console para continuar monitorando seus sites ou assine o Espartano para liberar histórico, alertas, agente local e prova controlada." +
      '<span class="scan-cta-row"><a class="btn btn-primary" href="' +
      (detail?.login_url || "/login") +
      '"><i class="fas fa-user-shield"></i> Entrar na console</a><a class="btn btn-ghost" href="' +
      (detail?.pricing_url || "/planos") +
      '"><i class="fas fa-crown"></i> Ver planos</a></span>';
    ["perfList", "secList", "mapList", "vulnList"].forEach((id) => {
      const node = document.getElementById(id);
      if (node)
        node.innerHTML =
          '<p class="muted-line">Limite diario gratuito atingido.</p>';
    });
    ["scoreTotal", "scorePerf", "scoreSec", "scoreVuln"].forEach((id) => {
      const node = document.getElementById(id);
      if (node) node.textContent = "--";
    });
    result.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderScan(report) {
    const r = document.getElementById("scanResult");
    r.hidden = false;

    const score = report.score || {};
    setScore(
      document.getElementById("scoreTotal"),
      document.getElementById("scoreBarTotal"),
      score.total,
    );
    setScore(
      document.getElementById("scorePerf"),
      document.getElementById("scoreBarPerf"),
      score.performance,
    );
    setScore(
      document.getElementById("scoreSec"),
      document.getElementById("scoreBarSec"),
      score.security,
    );
    setScore(
      document.getElementById("scoreVuln"),
      document.getElementById("scoreBarVuln"),
      score.vulnerabilities,
    );

    const perf = report.performance || {};
    const perfList = document.getElementById("perfList");
    perfList.innerHTML = "";
    perfList.appendChild(
      item(
        "Status HTTP",
        perf.status_code || "—",
        perf.status_code >= 400 ? "bad" : "",
      ),
    );
    perfList.appendChild(
      item("TTFB", fmtMs(perf.ttfb_ms), perf.ttfb_ms > 1500 ? "warn" : ""),
    );
    perfList.appendChild(
      item(
        "Tempo total",
        fmtMs(perf.total_ms),
        perf.total_ms > 3000 ? "bad" : perf.total_ms > 1500 ? "warn" : "",
      ),
    );
    perfList.appendChild(
      item("Peso da página", fmtBytes(perf.page_size_bytes)),
    );
    perfList.appendChild(
      item(
        "Redirecionamentos",
        perf.redirects || 0,
        perf.redirects > 2 ? "warn" : "",
      ),
    );

    const sec = report.security || {};
    const secList = document.getElementById("secList");
    secList.innerHTML = "";
    secList.appendChild(
      item(
        "HTTPS forçado",
        sec.https_enforced ? "sim" : "não",
        sec.https_enforced ? "" : "bad",
      ),
    );
    secList.appendChild(
      item(
        "Certificado TLS",
        sec.tls_valid
          ? "válido (" + (sec.tls_version || "TLS") + ")"
          : "inválido",
        sec.tls_valid ? "" : "bad",
      ),
    );
    secList.appendChild(
      item("Headers presentes", sec.headers_present_count || 0),
    );
    const missing = sec.headers_missing || [];
    secList.appendChild(
      item("Headers faltando", missing.length, missing.length ? "warn" : ""),
    );
    if (missing.length) {
      missing.slice(0, 4).forEach((m) => {
        secList.appendChild(item("• " + m.label, m.severity, "bad"));
      });
    }
    if (sec.cookies_issues && sec.cookies_issues.length) {
      secList.appendChild(
        item("Cookies inseguros", sec.cookies_issues.length, "warn"),
      );
    }

    const map = report.mapping || {};
    const mapList = document.getElementById("mapList");
    mapList.innerHTML = "";
    mapList.appendChild(item("Host", map.host || "—"));
    mapList.appendChild(item("IP", map.ip || "—"));
    const tech = (map.technologies || []).join(", ") || "—";
    mapList.appendChild(item("Tecnologias", tech));
    mapList.appendChild(item("Formulários", map.form_count || 0));
    mapList.appendChild(
      item("Login (campo password)", map.has_password_field ? "sim" : "não"),
    );

    const vulnList = document.getElementById("vulnList");
    vulnList.innerHTML = "";
    const vulns = report.vulnerabilities || [];
    if (!vulns.length) {
      vulnList.innerHTML =
        '<p class="muted-line"><i class="fas fa-shield-alt"></i> Nenhuma brecha óbvia. Continue a formação.</p>';
    } else {
      vulns.forEach((v) => {
        const div = document.createElement("div");
        div.className = "vuln";
        div.innerHTML =
          '<div class="vuln-head">' +
          '<span><i class="fas fa-folder-open"></i> ' +
          (v.path || v.type) +
          "</span>" +
          '<span class="vuln-sev ' +
          (v.severity || "HIGH") +
          '">' +
          (v.severity || "HIGH") +
          "</span>" +
          "</div>" +
          '<div class="vuln-evidence">' +
          (v.evidence || "").replace(/[<>]/g, "") +
          "</div>";
        vulnList.appendChild(div);
      });
    }

    document.getElementById("aiSummary").textContent =
      report.ai_summary ||
      "Diagnóstico automático indisponível neste scan público — peça uma análise completa em Falar com a Arkkhe.";
    renderDiagnostic(report.diagnostic || {}, report);
  }

  function renderDiagnostic(diagnostic, report) {
    const risk = document.getElementById("diagRisk");
    const headline = document.getElementById("diagHeadline");
    const plain = document.getElementById("diagPlain");
    const actionList = document.getElementById("actionList");
    const fixPrompt = document.getElementById("fixPrompt");
    const siteContext = document.getElementById("siteContext");
    const machineContext = document.getElementById("machineContext");
    if (!risk || !headline || !plain || !actionList || !fixPrompt) return;

    const riskLevel = diagnostic.risk_level || "INFO";
    risk.textContent = riskLevel;
    risk.className = "risk-pill " + riskLevel;
    headline.textContent = diagnostic.headline || "Diagnóstico concluído";
    plain.textContent =
      diagnostic.plain_language ||
      "O scan externo terminou. Use os números acima para priorizar correções e rode o agente local para entender a máquina.";

    actionList.innerHTML = "";
    const actions = diagnostic.priority_actions || [];
    actions.slice(0, 6).forEach((action) => {
      const li = document.createElement("li");
      li.innerHTML =
        "<strong>" +
        escapeHtml(action.title || "Ação recomendada") +
        "</strong>" +
        "<span>Estrago possível: " +
        escapeHtml(action.why || "Risco operacional ou de segurança.") +
        "</span>" +
        "<span>Correção: " +
        escapeHtml(action.how || "Revisar configuração e validar novamente.") +
        "</span>" +
        "<em>Responsável: " +
        escapeHtml(action.owner || "Equipe técnica") +
        " · Urgência: " +
        escapeHtml(action.urgency || "priorizar") +
        "</em>";
      actionList.appendChild(li);
    });
    if (!actionList.children.length) {
      const li = document.createElement("li");
      li.innerHTML =
        "<strong>Monitorar continuamente</strong><span>Nenhuma brecha óbvia apareceu neste scan externo, mas deploys e dependências podem mudar o risco.</span>";
      actionList.appendChild(li);
    }

    const prompt = diagnostic.fix_prompt || {
      role: "IA engenheira de segurança defensiva",
      goal: "Corrigir os problemas encontrados sem testes destrutivos",
      site: report.url,
      scores: report.score || {},
    };
    fixPrompt.textContent = JSON.stringify(prompt, null, 2).slice(0, 3200);
    siteContext.textContent =
      diagnostic.human_context?.site ||
      "O scan do site mede sinais públicos da URL: performance, TLS, headers, cookies, tecnologias e exposições.";
    machineContext.textContent =
      diagnostic.human_context?.machine ||
      "O scan da máquina exige agente autorizado para ler portas, processos, firewall, listeners e baseline local.";
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (ch) => {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      }[ch];
    });
  }

  function item(label, value, cls) {
    const li = document.createElement("li");
    if (cls) li.className = cls;
    li.innerHTML = "<span>" + label + "</span><b>" + value + "</b>";
    return li;
  }

  document.getElementById("scanForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("scanUrl");
    const url = input.value.trim();
    if (!url) return;
    const wrap = document.querySelector(".scan-input");
    wrap.classList.add("loading");
    try {
      track("scan_submit", { element: "scan_form", details: { url } });
      const data = await postJSON("/api/scan-site", {
        url,
        session_id: sessionId(),
      });
      renderScan(data);
      track("scan_complete", {
        element: "scan_result",
        details: { url, score: data.score || {} },
      });
      document
        .getElementById("scanResult")
        .scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      track("scan_error", {
        element: "scan_form",
        details: { url, message: err.message },
      });
      if (err.detail?.error === "free_scan_limit_reached") {
        showScanLimit(err.detail);
      } else {
        showScanError(err.detail?.message || err.message);
      }
    } finally {
      wrap.classList.remove("loading");
    }
  });

  // -------------------------------------------------------- Lead form
  document.getElementById("leadForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const status = document.getElementById("formStatus");
    const data = Object.fromEntries(new FormData(form).entries());
    status.className = "form-status";
    status.textContent = "Enviando...";
    try {
      track("lead_submit", {
        element: "lead_form",
        details: { plan: data.plan, site: data.site },
      });
      await postJSON("/api/lead", data);
      status.classList.add("ok");
      status.textContent = "✓ Recebido. A Arkkhe entra em contato em breve.";
      form.reset();
    } catch (err) {
      track("lead_error", {
        element: "lead_form",
        details: { message: err.message },
      });
      status.classList.add("err");
      status.textContent = "Erro: " + err.message;
    }
  });

  // -------------------------------------------------------- Threats ticker
  async function loadThreats() {
    const row = document.getElementById("tickerRow");
    if (!row) return;
    try {
      const r = await fetch("/api/threats/recent");
      const data = await r.json();
      const items = data.items || [];
      if (!items.length) {
        row.innerHTML =
          '<span class="muted-line">Aguardando primeira sincronização do CISA KEV...</span>';
        return;
      }
      row.innerHTML = "";
      items.forEach((it) => {
        const div = document.createElement("div");
        div.className =
          "ticker-item" + (it.ransomware === "Known" ? " ransom" : "");
        div.innerHTML =
          '<span class="ticker-cve">' +
          (it.cve || "?") +
          "</span>" +
          '<span class="ticker-name">' +
          (it.vendor || "?") +
          " &middot; " +
          (it.product || "?") +
          " — " +
          (it.name || "").slice(0, 90) +
          "</span>" +
          '<span class="ticker-when">' +
          (it.added || "") +
          (it.ransomware === "Known" ? " &middot; ransomware" : "") +
          "</span>";
        row.appendChild(div);
      });
    } catch (err) {
      row.innerHTML =
        '<span class="muted-line">Feed indisponível agora. Tentaremos novamente.</span>';
    }
  }

  // -------------------------------------------------------- Boot
  document.addEventListener("DOMContentLoaded", () => {
    initMatrix();
    animateCounters();
    if (window.requestIdleCallback) {
      window.requestIdleCallback(loadThreats, { timeout: 1200 });
    } else {
      window.setTimeout(loadThreats, 350);
    }
    track("page_view", { element: document.title });
    document.body.addEventListener("click", (e) => {
      const target = e.target.closest("a,button,[data-track]");
      if (!target) return;
      const label = labelFor(target);
      const href = target.getAttribute("href") || "";
      track(
        href.includes("#planos") || label.toLowerCase().includes("plano")
          ? "plan_click"
          : "click",
        {
          element: label,
          details: { href },
        },
      );
    });
  });
})();
