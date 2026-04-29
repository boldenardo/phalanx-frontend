/* ===== PHALANX CONSOLE ===== */
(function () {
  "use strict";

  const PK = window.PHALANX_CLERK_PK || "";
  if (!PK) {
    document.body.innerHTML =
      '<div style="padding:4rem;text-align:center;color:#ff6b6b;font-family:Fira Code,monospace">CLERK_PUBLISHABLE_KEY ausente. Defina no .env do servidor.</div>';
    return;
  }

  // ----------------------------------------------------------- carrega Clerk JS
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

  // ----------------------------------------------------------- helpers
  let clerk = null;

  async function authHeaders() {
    const token = await clerk.session?.getToken();
    return token ? { Authorization: "Bearer " + token } : {};
  }
  async function apiGet(path) {
    const r = await fetch(path, { headers: await authHeaders() });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }
  async function apiSend(method, path, body) {
    const r = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: body ? JSON.stringify(body) : null,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok)
      throw Object.assign(new Error(data.error || "HTTP " + r.status), {
        detail: data,
      });
    return data;
  }

  function fmtDate(ts) {
    if (!ts) return "—";
    const d = new Date(ts * 1000);
    return d.toLocaleString("pt-BR");
  }

  let latestDiagnosticText = "";

  function parsePayload(payload) {
    if (!payload) return {};
    if (typeof payload === "object") return payload;
    try {
      return JSON.parse(payload);
    } catch (e) {
      return {};
    }
  }

  function setTerminal(id, lines) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = lines.join("\n");
    el.scrollTop = el.scrollHeight;
  }

  function setDiagnosticBrief(machineText, siteText) {
    const wrap = document.getElementById("diagnosticBrief");
    if (!wrap) return;
    latestDiagnosticText = [machineText, siteText].filter(Boolean).join("\n\n");
    wrap.innerHTML = `
      <h3>Diagnóstico consolidado</h3>
      <p>${esc(machineText || "Sem dados de máquina recebidos ainda.")}</p>
      <p>${esc(siteText || "Sem scan de site autenticado ainda.")}</p>
      <div class="diag-note">Texto preparado para leitura humana e para colar em uma IA externa, sem instruções de correção automática.</div>
    `;
  }

  function buildMachineDiagnosis(scans) {
    const latest = (scans || [])[0];
    if (!latest) {
      const text =
        "Nenhum relatório de máquina chegou ao servidor ainda. O painel só consegue diagnosticar o endpoint depois que o agente local pareado executa um ciclo de scan e envia o resultado.";
      return {
        text,
        lines: [
          "$ phalanx-agent --diagnose endpoint",
          "[aguardando] nenhum scan de máquina encontrado na conta",
          "[contexto] confirme que existe uma licença ativa e que o agente local está pareado",
          "[status] diagnóstico endpoint indisponível por falta de telemetria",
        ],
      };
    }

    const summary = parsePayload(latest.summary);
    const openPorts = summary.open_ports || [];
    const changes = summary.changes || [];
    const machineDiagnostics = summary.machine_diagnostics || {};
    const findings = machineDiagnostics.findings || [];
    const toolchain = machineDiagnostics.toolchain || [];
    const listeningServices = machineDiagnostics.listening_services || [];
    const system = machineDiagnostics.system || {};
    const stable = !changes.length;
    const hostLabel = latest.hostname || "máquina sem hostname";
    const target = summary.target || "alvo não informado";
    const portsRange = summary.ports_range || "portas não informadas";
    const platformLabel =
      [summary.platform, summary.platform_release].filter(Boolean).join(" ") ||
      "plataforma não informada";
    const lines = [
      "$ phalanx-agent --diagnose endpoint",
      `[ok] relatório recebido em ${fmtDate(latest.created_at)}`,
      `[host] ${hostLabel}${latest.os_name ? " / " + latest.os_name : ""}`,
      `[plataforma] ${platformLabel}${summary.android_detected ? " | Android/Termux detectado" : ""}`,
      `[engine] ${summary.engine || "unknown"}`,
      `[sistema] cpu ${system.cpu_percent ?? "?"}% | memoria ${system.memory_percent ?? "?"}% | disco ${system.disk_percent ?? "?"}%`,
      `[scan] alvo ${target} | portas ${portsRange} | tipo ${latest.scan_type || "network"}`,
      `[rede] hosts observados: ${summary.hosts ?? 0} | portas abertas: ${summary.open_ports_count ?? openPorts.length}`,
      `[baseline] ${stable ? "sem mudanças em relação ao marco anterior" : changes.length + " mudança(s) detectada(s)"}`,
      `[diagnostico] achados concretos: ${findings.length} | listeners locais: ${listeningServices.length}`,
    ];

    if (toolchain.length) {
      lines.push("[repertorio defensivo]");
      toolchain.slice(0, 10).forEach((tool) => {
        lines.push(`  - ${tool.name}: ${tool.capability}`);
      });
    } else {
      lines.push(
        "[repertorio defensivo] nenhuma ferramenta externa detectada no PATH",
      );
    }

    if (openPorts.length) {
      lines.push("[portas abertas]");
      openPorts.slice(0, 12).forEach((p) => {
        const service = [p.service, p.product, p.version]
          .filter(Boolean)
          .join(" ");
        lines.push(
          `  - ${p.host}:${p.port} ${p.state || "open"} ${service || "serviço não identificado"}`,
        );
      });
      if (openPorts.length > 12)
        lines.push(
          `  - ... ${openPorts.length - 12} porta(s) adicionais ocultadas no resumo`,
        );
    } else {
      lines.push(
        "[portas abertas] nenhuma porta aberta registrada no recorte enviado",
      );
    }

    if (changes.length) {
      lines.push("[mudanças]");
      changes.slice(0, 8).forEach((change) => lines.push(`  - ${change}`));
    }

    if (findings.length) {
      lines.push("[achados concretos]");
      findings.slice(0, 12).forEach((finding) => {
        lines.push(
          `  - ${finding.severity || "INFO"} ${finding.category || "diagnostic"}: ${finding.title || "achado"} | ${finding.evidence || "sem evidencia"}`,
        );
      });
    }

    if (listeningServices.length) {
      lines.push("[listeners locais]");
      listeningServices.slice(0, 10).forEach((svc) => {
        lines.push(
          `  - ${svc.host}:${svc.port} ${svc.process || "unknown"} pid=${svc.pid || "?"}${svc.public_bind ? " | todas interfaces" : ""}`,
        );
      });
    }

    const text = stable
      ? `A máquina ${hostLabel} (${platformLabel}, engine ${summary.engine || "unknown"}) apresentou um scan estável: ${summary.hosts ?? 0} host(s) observado(s), ${summary.open_ports_count ?? openPorts.length} porta(s) aberta(s), ${findings.length} achado(s) concreto(s) e nenhuma mudança de baseline registrada no último ciclo.`
      : `A máquina ${hostLabel} (${platformLabel}, engine ${summary.engine || "unknown"}) apresentou alteração de superfície: ${changes.length} mudança(s) em relação ao baseline, ${findings.length} achado(s) concreto(s) e ${summary.open_ports_count ?? openPorts.length} porta(s) aberta(s) no recorte do último scan.`;

    return { text, lines };
  }

  function buildSiteDiagnosis(scan) {
    if (!scan) {
      const text =
        "Nenhum relatório completo de site foi carregado ainda. O painel exibirá o diagnóstico depois do primeiro scan autenticado em Sites monitorados.";
      return {
        text,
        lines: [
          "$ phalanx-webscan --diagnose site",
          "[aguardando] nenhum histórico de site encontrado",
          "[status] diagnóstico web indisponível por falta de relatório",
        ],
      };
    }

    const report = parsePayload(scan.payload_json);
    const perf = report.performance || {};
    const security = report.security || {};
    const tls = security.tls || {};
    const mapping = report.mapping || {};
    const firecrawl = mapping.firecrawl || null;
    const activeValidation = report.active_validation || {};
    const activeFindings = activeValidation.findings || [];
    const vulns = report.vulnerabilities || [];
    const missing = security.headers_missing || [];
    const cookies = security.cookies_issues || [];
    const score = report.score || {};
    const sizeKb = Math.round((perf.page_size_bytes || 0) / 1024);
    const lines = [
      "$ phalanx-webscan --diagnose site",
      `[ok] relatório carregado em ${fmtDate(scan.created_at)}`,
      `[url] ${report.url || scan.url}`,
      `[http] status ${perf.status_code ?? "?"} | final ${perf.final_url || report.url || scan.url}`,
      `[tempo] TTFB ${perf.ttfb_ms ?? "?"}ms | total ${perf.total_ms ?? "?"}ms | peso ${sizeKb}KB | redirects ${perf.redirects ?? 0}`,
      `[tls] ${tls.valid ? "válido" : "não validado"}${tls.tls_version ? " | " + tls.tls_version : ""}${tls.issuer ? " | emissor " + tls.issuer : ""}`,
      `[headers] presentes ${(security.headers_present || []).length} | ausentes ${missing.length}`,
      `[cookies] ${cookies.length} cookie(s) com flags incompletas`,
      `[mapa] host ${mapping.host || "?"} | ip ${mapping.ip || "?"} | tecnologias ${(mapping.technologies || []).join(", ") || "não identificadas"}`,
      `[firecrawl] ${firecrawl ? (firecrawl.ok ? "ativo | " + (firecrawl.discovered_count ?? 0) + " rota(s) mapeada(s)" : "ativo | indisponível no scan") : "sem agente Firecrawl no relatório"}`,
      `[vulnerabilidades] ${vulns.length} achado(s) de exposição direta`,
      `[prova controlada] ${activeValidation.enabled ? "confirmada | " + activeFindings.length + " evidencia(s)" : "não executada"}`,
      `[score] total ${score.total ?? scan.score_total ?? "?"} | perf ${score.performance ?? scan.score_perf ?? "?"} | sec ${score.security ?? scan.score_sec ?? "?"} | vuln ${score.vulnerabilities ?? scan.score_vuln ?? "?"}`,
    ];

    if (missing.length) {
      lines.push("[headers ausentes]");
      missing
        .slice(0, 8)
        .forEach((h) =>
          lines.push(`  - ${h.label || h.header} (${h.severity || "INFO"})`),
        );
    }
    if (vulns.length) {
      lines.push("[exposição]");
      vulns
        .slice(0, 8)
        .forEach((v) =>
          lines.push(
            `  - ${v.type || "finding"} em ${v.path || "?"} (${v.severity || "INFO"})`,
          ),
        );
    }

    if (firecrawl?.links_sample?.length) {
      lines.push("[rotas Firecrawl]");
      firecrawl.links_sample
        .slice(0, 8)
        .forEach((link) => lines.push(`  - ${link}`));
    }

    if (activeFindings.length) {
      lines.push("[provas bug bounty controladas]");
      activeFindings.slice(0, 10).forEach((finding) => {
        lines.push(
          `  - ${finding.severity || "INFO"} ${finding.type || "proof"}: ${finding.title || "prova"} | ${finding.evidence || "sem evidencia"}`,
        );
      });
    }

    const firecrawlText = firecrawl
      ? ` O Firecrawl ${firecrawl.ok ? "mapeou " + (firecrawl.discovered_count ?? 0) + " rota(s) adicionais" : "foi chamado, mas não retornou mapa utilizável nesse scan"}.`
      : " O relatório não contém mapeamento Firecrawl.";
    const activeText = activeValidation.enabled
      ? ` A prova controlada paga adicionou ${activeFindings.length} evidência(s) estilo bug bounty, sem exploração destrutiva.`
      : " A prova controlada paga não foi executada neste relatório.";
    const text = `O site ${report.url || scan.url} respondeu com HTTP ${perf.status_code ?? "?"}, tempo total de ${perf.total_ms ?? "?"}ms, score geral ${score.total ?? scan.score_total ?? "?"}, ${missing.length} header(s) de segurança ausente(s), ${cookies.length} cookie(s) com flags incompletas e ${vulns.length} achado(s) de exposição direta.${firecrawlText}${activeText}`;
    return { text, lines };
  }

  async function loadDiagnostic(scanId) {
    setTerminal("machineTerminal", [
      "$ phalanx-agent --diagnose endpoint",
      "[carregando] consultando relatórios de máquina...",
    ]);
    setTerminal("siteTerminal", [
      "$ phalanx-webscan --diagnose site",
      "[carregando] consultando histórico de sites...",
    ]);

    const [machineData, historyData] = await Promise.all([
      apiGet("/api/account/machine-scans?limit=1").catch(() => ({ scans: [] })),
      apiGet("/api/account/history").catch(() => ({ history: [] })),
    ]);
    const machine = buildMachineDiagnosis(machineData.scans || []);
    setTerminal("machineTerminal", machine.lines);

    const history = historyData.history || [];
    const selectedId = scanId || history[0]?.id;
    let siteReport = null;
    if (selectedId) {
      const detail = await apiGet("/api/account/history/" + selectedId).catch(
        () => null,
      );
      siteReport = detail?.scan || null;
    }
    const site = buildSiteDiagnosis(siteReport);
    setTerminal("siteTerminal", site.lines);
    setDiagnosticBrief(machine.text, site.text);
  }

  function setHero(heroKey) {
    document.querySelectorAll(".hero-card").forEach((card) => {
      card.classList.toggle("active", card.dataset.hero === heroKey);
    });
  }

  async function loadProfile() {
    const data = await apiGet("/api/account/profile");
    setHero(data.profile?.hero_key || "sentinel");
  }

  async function saveProfile(heroKey) {
    setHero(heroKey);
    await apiSend("POST", "/api/account/profile", { hero_key: heroKey });
  }

  // ----------------------------------------------------------- modal
  const modal = document.getElementById("modal");
  const modalBody = document.getElementById("modalBody");
  document.getElementById("modalClose").addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  function openModal(html) {
    modalBody.innerHTML = html;
    modal.hidden = false;
  }
  function closeModal() {
    modal.hidden = true;
    modalBody.innerHTML = "";
  }

  // ----------------------------------------------------------- views
  async function loadLicenses() {
    try {
      const data = await apiGet("/api/licenses");
      const grid = document.getElementById("licenses");
      const list = data.licenses || [];
      document.getElementById("licCount").textContent =
        list.length + " licen" + (list.length === 1 ? "ça" : "ças");
      if (!list.length) {
        grid.innerHTML =
          '<p class="muted-line">Nenhuma licença ainda. Clique em "Nova licença" para emitir a primeira.</p>';
        return;
      }
      grid.innerHTML = "";
      list.forEach((l) => grid.appendChild(licenseCard(l)));
    } catch (e) {
      console.error(e);
    }
  }

  function licenseCard(l) {
    const card = document.createElement("div");
    card.className = "lic";
    const machine = l.machine
      ? `<div class="lic-machine">
          <b>${esc(l.machine.hostname || "sem hostname")}</b>
          <span>UUID: ${esc(l.machine.machine_uuid)}</span>
          <span>OS: ${esc(l.machine.os_name || "?")} &middot; IP: ${esc(l.machine.last_ip || "?")}</span>
          <span>Heartbeat: ${fmtDate(l.machine.last_heartbeat)}</span>
        </div>`
      : '<div class="lic-machine"><span>Aguardando pareamento</span></div>';

    const tokenBox =
      l.status === "pending" && l.pair_token
        ? `<div class="lic-machine" style="border-left-color:var(--warning);">
             <span>Pair token (uso único)</span>
             <b style="font-family:var(--mono);font-size:.85rem;color:var(--warning);word-break:break-all">${esc(l.pair_token)}</b>
           </div>`
        : "";

    const actions = [];
    if (l.status === "pending") {
      actions.push(
        `<button class="btn btn-ghost" data-act="copy" data-id="${l.id}"><i class="fas fa-copy"></i> Copiar token</button>`,
      );
    }
    if (l.status === "active") {
      actions.push(
        `<button class="btn btn-ghost" data-act="regen" data-id="${l.id}"><i class="fas fa-rotate"></i> Regenerar</button>`,
      );
    }
    if (l.status !== "revoked") {
      actions.push(
        `<button class="btn btn-ghost" data-act="revoke" data-id="${l.id}" style="color:var(--danger);border-color:rgba(255,71,87,.3)"><i class="fas fa-ban"></i> Revogar</button>`,
      );
    }
    actions.push(
      `<button class="btn btn-ghost" data-act="del" data-id="${l.id}"><i class="fas fa-trash"></i> Excluir</button>`,
    );

    card.innerHTML = `
      <div class="lic-head">
        <span class="lic-plan">${esc(l.plan)}</span>
        <span class="lic-status ${l.status}">${l.status.toUpperCase()}</span>
      </div>
      <div class="lic-label">${esc(l.label || "Licença #" + l.id)}</div>
      ${machine}
      ${tokenBox}
      <div class="lic-meta">Criada: ${fmtDate(l.created_at)} ${l.paired_at ? "&middot; Pareada: " + fmtDate(l.paired_at) : ""}</div>
      <div class="lic-actions">${actions.join("")}</div>
    `;

    card.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      const act = btn.dataset.act;
      const id = btn.dataset.id;
      try {
        if (act === "copy") {
          await navigator.clipboard.writeText(l.pair_token);
          btn.innerHTML = '<i class="fas fa-check"></i> Copiado';
          setTimeout(() => loadLicenses(), 1200);
        } else if (act === "regen") {
          if (
            !confirm("Regerar token desconectará a máquina pareada. Continuar?")
          )
            return;
          const r = await apiSend("POST", `/api/licenses/${id}/regenerate`);
          showToken(r.pair_token);
          loadLicenses();
        } else if (act === "revoke") {
          if (!confirm("Revogar essa licença? A máquina será desconectada."))
            return;
          await apiSend("POST", `/api/licenses/${id}/revoke`);
          loadLicenses();
        } else if (act === "del") {
          if (!confirm("Excluir definitivamente?")) return;
          await apiSend("DELETE", `/api/licenses/${id}`);
          loadLicenses();
        }
      } catch (err) {
        alert("Erro: " + err.message);
      }
    });
    return card;
  }

  function showToken(token) {
    openModal(`
      <h3><i class="fas fa-key"></i> Sua chave de licença</h3>
      <p class="muted-line" style="margin-bottom:1rem">Copie agora — depois de fechar, ela só aparece em e-mail.</p>
      <div class="token-display" id="tokenBox">${esc(token)}</div>
      <p class="copy-hint">Clique acima para copiar</p>
      <div class="actions">
        <button class="btn btn-ghost" id="btnDl">Baixar instalador (Linux/macOS)</button>
        <button class="btn btn-primary" id="btnDone">Pronto</button>
      </div>
    `);
    document.getElementById("tokenBox").addEventListener("click", () => {
      navigator.clipboard.writeText(token);
      document.getElementById("tokenBox").textContent = "✓ COPIADO";
    });
    document.getElementById("btnDl").addEventListener("click", () => {
      window.open(
        `/api/agent/install?os=linux&token=${encodeURIComponent(token)}`,
        "_blank",
      );
    });
    document.getElementById("btnDone").addEventListener("click", closeModal);
  }

  async function loadSites() {
    const data = await apiGet("/api/sites");
    const list = data.sites || [];
    const wrap = document.getElementById("sites");
    if (!list.length) {
      wrap.innerHTML =
        '<p class="muted-line">Nenhum site monitorado. Adicione acima.</p>';
      return;
    }
    wrap.innerHTML = "";
    list.forEach((s) => {
      const row = document.createElement("div");
      row.className = "site-row";
      row.innerHTML = `
        <div>
          <div class="url">${esc(s.url)}</div>
          <div class="meta">${s.last_score != null ? "Score: " + s.last_score : "Aguardando primeiro scan"} ${s.last_scan_at ? "&middot; " + fmtDate(s.last_scan_at) : ""}</div>
        </div>
        <div class="site-actions">
          <button data-act="scan" data-id="${s.id}"><i class="fas fa-radar"></i> Scan</button>
          <button data-act="proof" data-id="${s.id}"><i class="fas fa-bug"></i> Prova paga</button>
          <button data-act="remove" data-id="${s.id}"><i class="fas fa-trash"></i> Remover</button>
        </div>
      `;
      row.addEventListener("click", async (event) => {
        const btn = event.target.closest("button[data-act]");
        if (!btn) return;
        if (btn.dataset.act === "scan" || btn.dataset.act === "proof") {
          const isProof = btn.dataset.act === "proof";
          if (isProof) {
            const confirmed = confirm(
              "Executar prova controlada paga? Use somente em site seu ou com autorização formal. O scan faz requisições benignas para gerar evidências, sem exploração destrutiva.",
            );
            if (!confirmed) return;
          }
          btn.disabled = true;
          btn.innerHTML = isProof
            ? '<i class="fas fa-circle-notch fa-spin"></i> Prova'
            : '<i class="fas fa-circle-notch fa-spin"></i> Scan';
          setTerminal("siteTerminal", [
            isProof
              ? "$ phalanx-webscan --proof paid --confirmed"
              : "$ phalanx-webscan --diagnose site",
            `[iniciando] alvo ${s.url}`,
            "[1/5] abrindo conexão HTTP e medindo tempo de resposta",
            "[2/5] coletando headers, TLS e cookies",
            "[3/5] mapeando tecnologias e estrutura visível",
            isProof
              ? "[4/5] executando provas controladas de evidência"
              : "[4/5] procurando caminhos sensíveis expostos",
            "[5/5] consolidando diagnóstico para leitura",
          ]);
          try {
            const result = await apiSend(
              "POST",
              "/api/sites/" + s.id + "/scan",
              { active_validation_confirmed: isProof },
            );
            await Promise.all([loadSites(), loadHistory()]);
            await loadDiagnostic(result.scan_id);
          } catch (err) {
            setTerminal("siteTerminal", [
              "$ phalanx-webscan --diagnose site",
              `[erro] ${err.message}`,
              "[status] o scan não retornou relatório utilizável",
            ]);
            alert("Erro: " + err.message);
          }
          return;
        }
        if (!confirm("Remover " + s.url + "?")) return;
        await apiSend("DELETE", "/api/sites/" + s.id);
        await loadSites();
      });
      wrap.appendChild(row);
    });
  }

  async function loadHistory() {
    const data = await apiGet("/api/account/history");
    const list = data.history || [];
    const wrap = document.getElementById("history");
    if (!list.length) {
      wrap.innerHTML =
        '<p class="muted-line">Nenhum scan autenticado ainda. Rode um scan em Sites monitorados.</p>';
      return;
    }
    wrap.innerHTML = "";
    list.forEach((h) => {
      const row = document.createElement("div");
      row.className = "history-row";
      row.innerHTML = `
        <div>
          <b>${esc(h.url)}</b>
          <span>${fmtDate(h.created_at)}</span>
        </div>
        <div class="history-score">
          <strong>${h.score_total == null ? "—" : h.score_total}</strong>
          <small>Perf ${h.score_perf ?? "—"} · Sec ${h.score_sec ?? "—"} · Vuln ${h.score_vuln ?? "—"}</small>
          <button class="history-diag" type="button" data-scan-id="${h.id}">Ver diagnóstico</button>
        </div>
      `;
      row
        .querySelector(".history-diag")
        .addEventListener("click", () => loadDiagnostic(h.id));
      wrap.appendChild(row);
    });
  }

  async function loadAlerts() {
    const data = await apiGet("/api/account/alerts");
    const list = data.alerts || [];
    const wrap = document.getElementById("alerts");
    if (!list.length) {
      wrap.innerHTML =
        '<p class="muted-line">Nenhum alerta. Suas máquinas estão na formação.</p>';
      return;
    }
    wrap.innerHTML = "";
    list.forEach((a) => {
      const row = document.createElement("div");
      row.className = "alert-row " + (a.level || "INFO");
      row.innerHTML = `
        <div class="when">${fmtDate(a.created_at)}<br><span style="color:var(--text-3)">${esc(a.hostname || "")}</span></div>
        <div class="body"><b>${esc(a.title || "")}</b>${esc(a.message || "")}</div>
      `;
      wrap.appendChild(row);
    });
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
    );
  }

  // ----------------------------------------------------------- new license modal
  document.getElementById("btnNewLicense").addEventListener("click", () => {
    openModal(`
      <h3><i class="fas fa-plus"></i> Nova licença</h3>
      <form id="newLicForm">
        <label><span>Plano</span>
          <select name="plan">
            <option value="hoplita">Hoplita (free)</option>
            <option value="espartano" selected>Espartano</option>
            <option value="leonidas">Leônidas</option>
          </select>
        </label>
        <label><span>Apelido (ex: PC do escritório)</span>
          <input type="text" name="label" maxlength="120" placeholder="Servidor cliente X"/>
        </label>
        <label><span>Validade do token (dias) — em branco = sem expirar</span>
          <input type="number" name="expires_in_days" min="1" max="90" placeholder="14"/>
        </label>
        <div class="actions">
          <button type="button" class="btn btn-ghost" id="btnCancel">Cancelar</button>
          <button type="submit" class="btn btn-primary"><i class="fas fa-key"></i> Emitir</button>
        </div>
      </form>
    `);
    document.getElementById("btnCancel").addEventListener("click", closeModal);
    document
      .getElementById("newLicForm")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = Object.fromEntries(new FormData(e.currentTarget).entries());
        try {
          const r = await apiSend("POST", "/api/licenses", fd);
          showToken(r.license.pair_token);
          loadLicenses();
        } catch (err) {
          alert("Erro: " + err.message);
        }
      });
  });

  // ----------------------------------------------------------- add site
  document
    .getElementById("addSiteForm")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.currentTarget).entries());
      try {
        await apiSend("POST", "/api/sites", fd);
        e.currentTarget.reset();
        loadSites();
      } catch (err) {
        alert("Erro: " + err.message);
      }
    });

  document.getElementById("heroPicker").addEventListener("click", async (e) => {
    const card = e.target.closest(".hero-card[data-hero]");
    if (!card) return;
    try {
      await saveProfile(card.dataset.hero);
    } catch (err) {
      alert("Erro salvando perfil: " + err.message);
    }
  });

  document
    .getElementById("btnRefreshHistory")
    .addEventListener("click", async () => {
      await loadHistory();
      await loadDiagnostic();
    });

  document
    .getElementById("btnRefreshDiagnostic")
    .addEventListener("click", () => loadDiagnostic());

  document
    .getElementById("btnCopyDiagnostic")
    .addEventListener("click", async () => {
      if (!latestDiagnosticText) await loadDiagnostic();
      await navigator.clipboard.writeText(
        latestDiagnosticText || "Diagnóstico indisponível.",
      );
      const btn = document.getElementById("btnCopyDiagnostic");
      const original = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-check"></i> Copiado';
      setTimeout(() => {
        btn.innerHTML = original;
      }, 1400);
    });

  // ----------------------------------------------------------- boot
  async function boot() {
    try {
      await loadClerk();
    } catch (e) {
      document.body.innerHTML =
        '<div style="padding:4rem;text-align:center;color:#ff6b6b;font-family:Fira Code,monospace">Falha carregando Clerk: ' +
        e.message +
        "</div>";
      return;
    }
    clerk = window.Clerk;
    await clerk.load();

    function render() {
      const signedOut = document.getElementById("signedOut");
      const signedIn = document.getElementById("signedIn");
      const userArea = document.getElementById("userArea");
      if (clerk.user) {
        signedOut.hidden = true;
        signedIn.hidden = false;
        document.getElementById("helloName").textContent =
          "Salve, " +
          (clerk.user.firstName || clerk.user.username || "guerreiro") +
          ".";
        document.getElementById("accountEmail").textContent =
          clerk.user.primaryEmailAddress?.emailAddress || "";
        userArea.innerHTML = "<span></span>";
        clerk.mountUserButton(userArea.querySelector("span"));

        // sync conta + carrega tudo
        apiSend("POST", "/api/account/sync")
          .then((res) => {
            setHero(res.profile?.hero_key || "sentinel");
            return Promise.all([
              loadProfile(),
              loadLicenses(),
              loadSites(),
              loadHistory(),
              loadDiagnostic(),
              loadAlerts(),
            ]);
          })
          .catch((e) => console.error("sync falhou", e));
      } else {
        signedOut.hidden = false;
        signedIn.hidden = true;
        userArea.innerHTML = "";
        const target = document.getElementById("clerkSignIn");
        target.innerHTML = "";
        clerk.mountSignIn(target, {
          afterSignInUrl: "/console",
          afterSignUpUrl: "/console",
          appearance: authAppearance(),
        });
      }
    }
    render();
    clerk.addListener(render);
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
