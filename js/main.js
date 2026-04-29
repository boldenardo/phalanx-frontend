/* ===== PHALANX DASHBOARD v4.0 - main.js ===== */
document.addEventListener('DOMContentLoaded', function() {

  var API = '/api';
  var POLL_INTERVAL = 5000;

  // ===== LOADER =====
  var loaderScreen = document.getElementById('loader');
  var loaderBar = document.getElementById('loaderBar');
  var loaderPct = document.getElementById('loaderPct');
  var progress = 0;

  function tickLoader() {
    progress += Math.random() * 15 + 5;
    if (progress > 100) progress = 100;
    loaderBar.style.width = progress + '%';
    loaderPct.textContent = Math.round(progress) + '%';
    if (progress < 100) {
      setTimeout(tickLoader, 60 + Math.random() * 100);
    } else {
      setTimeout(function() {
        loaderScreen.classList.add('hidden');
        document.body.style.overflow = '';
        startDashboard();
      }, 400);
    }
  }
  document.body.style.overflow = 'hidden';
  tickLoader();

  // ===== MATRIX CANVAS =====
  function initMatrix() {
    var canvas = document.getElementById('matrixCanvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var chars = 'PHALANX01#SHIELD'.split('');
    var cols, drops;

    function resize() {
      canvas.width = canvas.parentElement.offsetWidth;
      canvas.height = canvas.parentElement.offsetHeight;
      cols = Math.floor(canvas.width / 16);
      drops = Array(cols).fill(1);
    }
    resize();
    window.addEventListener('resize', resize);

    function draw() {
      ctx.fillStyle = 'rgba(5,8,16,0.06)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#00ff8850';
      ctx.font = '12px "Fira Code", monospace';
      for (var i = 0; i < cols; i++) {
        var ch = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(ch, i * 16, drops[i] * 16);
        if (drops[i] * 16 > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
      requestAnimationFrame(draw);
    }
    draw();
  }

  // ===== NAVIGATION =====
  var navItems = document.querySelectorAll('.nav-item');
  var pages = document.querySelectorAll('.page');

  navItems.forEach(function(item) {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      var target = item.getAttribute('data-page');
      navItems.forEach(function(n) { n.classList.remove('active'); });
      item.classList.add('active');
      pages.forEach(function(p) {
        p.classList.remove('active');
        if (p.id === 'page-' + target) p.classList.add('active');
      });
      document.getElementById('topbarNav').classList.remove('active');
      document.getElementById('menuToggle').classList.remove('active');
      document.body.style.overflow = '';
    });
  });

  // Mobile menu
  var menuToggle = document.getElementById('menuToggle');
  var topbarNav = document.getElementById('topbarNav');
  if (menuToggle) {
    menuToggle.addEventListener('click', function() {
      var isOpen = menuToggle.classList.toggle('active');
      topbarNav.classList.toggle('active');
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });
  }

  // Topbar scroll
  var topbar = document.getElementById('topbar');
  window.addEventListener('scroll', function() {
    if (topbar) topbar.classList.toggle('scrolled', window.pageYOffset > 30);
  });

  // ===== MODULES DATA =====
  var MODULES = [
    { name: 'Network Scanner', icon: 'fa-network-wired', file: 'scanner.py',
      desc: 'Varre portas e servicos em busca de vulnerabilidades. Como os batedores que precediam a formacao espartana.' },
    { name: 'AI Threat Detector', icon: 'fa-brain', file: 'detector.py',
      desc: 'Motor de IA com Llama 4 Scout que analisa padroes comportamentais e identifica ameacas em tempo real.' },
    { name: 'Honeypot System', icon: 'fa-spider', file: 'honeypot.py',
      desc: 'Armadilhas digitais que atraem atacantes para terreno controlado. A estrategia do engano.' },
    { name: 'Forensic Analysis', icon: 'fa-fingerprint', file: 'forensics.py',
      desc: 'Analise forense automatizada. Cada ataque deixa um rastro; nos encontramos.' },
    { name: 'YARA Scanner', icon: 'fa-virus-slash', file: 'yara_scanner.py',
      desc: 'Deteccao por assinaturas YARA. Identifica malware conhecido com precisao cirurgica.' },
    { name: 'Sandbox Engine', icon: 'fa-flask', file: 'sandbox_engine.py',
      desc: 'Executa arquivos suspeitos em ambiente isolado. O campo de provas antes da batalha.' },
    { name: 'File Monitor', icon: 'fa-eye', file: 'file_monitor.py',
      desc: 'Vigilancia constante sobre arquivos criticos. Qualquer alteracao e detectada instantaneamente.' },
    { name: 'Log Monitor', icon: 'fa-scroll', file: 'log_monitor.py',
      desc: 'Analise continua de logs do sistema. Cada linha conta uma historia.' },
    { name: 'Vulnerability Auditor', icon: 'fa-magnifying-glass-chart', file: 'vulnerability_auditor.py',
      desc: 'Auditoria de vulnerabilidades. Encontra as brechas antes que o inimigo as explore.' },
    { name: 'Self Protection', icon: 'fa-lock', file: 'self_protection.py',
      desc: 'O escudo que protege o proprio escudo. Anti-tamper e integridade do Phalanx.' },
    { name: 'WhatsApp Alerts', icon: 'fa-message', file: 'whatsapp_interface.py',
      desc: 'Alertas em tempo real via WhatsApp. Porque o guerreiro precisa saber quando a muralha e testada.' },
    { name: 'Auto Updater', icon: 'fa-arrows-rotate', file: 'updater.py',
      desc: 'Atualizacao automatica de regras e assinaturas. Um exercito que nunca para de evoluir.' }
  ];

  function renderModules() {
    var grid = document.getElementById('modulesGrid');
    if (!grid) return;
    grid.innerHTML = '';
    MODULES.forEach(function(m) {
      var card = document.createElement('div');
      card.className = 'module-card';
      card.innerHTML =
        '<div class="module-top">' +
          '<div class="module-icon"><i class="fas ' + m.icon + '"></i></div>' +
          '<span class="module-status active">ATIVO</span>' +
        '</div>' +
        '<div class="module-name">' + m.name + '</div>' +
        '<p class="module-desc">' + m.desc + '</p>' +
        '<span class="module-file">' + m.file + '</span>';
      grid.appendChild(card);
    });
  }

  // ===== ALERTS =====
  var alertsData = [];

  function renderAlerts(filter) {
    var list = document.getElementById('alertsList');
    if (!list) return;
    var filtered = filter === 'all' ? alertsData : alertsData.filter(function(a) { return a.level === filter; });
    if (filtered.length === 0) {
      list.innerHTML = '<div class="empty-state"><i class="fas fa-bell-slash"></i><p>Nenhum alerta neste filtro. Zona segura.</p></div>';
      return;
    }
    list.innerHTML = '';
    filtered.forEach(function(a) {
      var icons = { critical: 'fa-circle-exclamation', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };
      var div = document.createElement('div');
      div.className = 'alert-item ' + a.level;
      div.innerHTML =
        '<div class="alert-icon"><i class="fas ' + (icons[a.level] || 'fa-bell') + '"></i></div>' +
        '<div class="alert-body"><div class="alert-title">' + a.title + '</div><div class="alert-msg">' + a.message + '</div></div>' +
        '<span class="alert-time">' + a.time + '</span>';
      list.appendChild(div);
    });
  }

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      renderAlerts(btn.getAttribute('data-level'));
    });
  });

  // ===== LOGS =====
  var maxLogLines = 200;

  function addLogLine(time, msg, cls) {
    var body = document.getElementById('logBody');
    if (!body) return;
    var line = document.createElement('div');
    line.className = 'log-line';
    line.innerHTML = '<span class="log-time">' + time + '</span><span class="log-msg ' + (cls || '') + '">' + msg + '</span>';
    body.appendChild(line);
    while (body.children.length > maxLogLines) body.removeChild(body.firstChild);
    body.scrollTop = body.scrollHeight;
  }

  // ===== API POLLING =====
  function fetchData() {
    fetch(API + '/status').then(function(r) { return r.json(); }).then(function(data) {
      // KPIs
      animateNumber('kpiThreats', data.threats_blocked || 0);
      animateNumber('kpiScans', data.scans || 0);
      animateNumber('kpiAlerts', data.alerts_sent || 0);
      var up = data.uptime_hours || 0;
      document.getElementById('kpiUptime').textContent = up + 'h';

      // Status pill
      var pill = document.getElementById('statusPill');
      if (pill) {
        var dot = pill.querySelector('.status-dot');
        var label = pill.querySelector('.status-label');
        if (data.online) {
          dot.className = 'status-dot online';
          label.textContent = 'ESCUDO ATIVO';
          label.style.color = 'var(--success)';
        } else {
          dot.className = 'status-dot offline';
          label.textContent = 'OFFLINE';
          label.style.color = 'var(--danger)';
        }
      }

      // Resources
      updateResource('Cpu', data.cpu_percent || 0);
      updateResource('Ram', data.ram_percent || 0);
      updateResource('Disk', data.disk_percent || 0);

      var netKB = data.net_bytes_sec ? Math.round(data.net_bytes_sec / 1024) : 0;
      var elNet = document.getElementById('resNet');
      if (elNet) elNet.textContent = netKB + ' KB/s';
      var netBar = document.getElementById('resNetBar');
      if (netBar) {
        var netPct = Math.min(100, netKB / 10);
        netBar.style.width = netPct + '%';
        setBarColor(netBar, netPct);
      }

      var elCores = document.getElementById('resCores');
      if (elCores && data.cpu_cores) elCores.textContent = data.cpu_cores + ' cores';
      var elRamT = document.getElementById('resRamTotal');
      if (elRamT && data.ram_total_gb) elRamT.textContent = data.ram_total_gb + ' GB RAM';
      var elProcs = document.getElementById('resProcs');
      if (elProcs && data.process_count) elProcs.textContent = data.process_count + ' processos';

      // Alert badge
      var badge = document.getElementById('alertBadge');
      if (badge && data.pending_alerts != null) {
        badge.textContent = data.pending_alerts;
        badge.style.display = data.pending_alerts > 0 ? '' : 'none';
      }

    }).catch(function() { /* API offline */ });

    // Timeline
    fetch(API + '/timeline').then(function(r) { return r.json(); }).then(function(items) {
      var list = document.getElementById('timelineList');
      if (!list || !items.length) return;
      list.innerHTML = '';
      items.slice(0, 50).forEach(function(e) {
        var div = document.createElement('div');
        div.className = 'timeline-entry ' + (e.level || 'info');
        div.innerHTML =
          '<span class="tl-time">' + (e.time || '--:--') + '</span>' +
          '<span class="tl-msg">' + (e.message || '') + '</span>' +
          '<span class="tl-level ' + (e.level || 'info') + '">' + (e.level || 'info') + '</span>';
        list.appendChild(div);
      });
    }).catch(function() {});

    // Alerts
    fetch(API + '/alerts').then(function(r) { return r.json(); }).then(function(items) {
      alertsData = items || [];
      var activeFilter = document.querySelector('.filter-btn.active');
      renderAlerts(activeFilter ? activeFilter.getAttribute('data-level') : 'all');

      // Threats summary
      var crit = 0, warn = 0, inf = 0, blocked = 0;
      alertsData.forEach(function(a) {
        if (a.level === 'critical') crit++;
        else if (a.level === 'warning') warn++;
        else inf++;
        if (a.blocked) blocked++;
      });
      setText('tCritical', crit);
      setText('tWarning', warn);
      setText('tLow', inf);
      setText('tBlocked', blocked);
    }).catch(function() {});

    // Logs
    fetch(API + '/logs').then(function(r) { return r.json(); }).then(function(lines) {
      var body = document.getElementById('logBody');
      if (!body || !lines.length) return;
      body.innerHTML = '';
      lines.forEach(function(l) {
        addLogLine(l.time || '--:--:--', l.message || '', l.cls || '');
      });
    }).catch(function() {});
  }

  // ===== HELPERS =====
  function animateNumber(id, target) {
    var el = document.getElementById(id);
    if (!el) return;
    var current = parseInt(el.textContent.replace(/[^0-9]/g, '')) || 0;
    if (current === target) return;
    var step = Math.max(1, Math.ceil(Math.abs(target - current) / 30));
    var dir = target > current ? 1 : -1;
    var iv = setInterval(function() {
      current += step * dir;
      if ((dir === 1 && current >= target) || (dir === -1 && current <= target)) {
        current = target;
        clearInterval(iv);
      }
      el.textContent = current.toLocaleString();
    }, 25);
  }

  function updateResource(name, pct) {
    var val = document.getElementById('res' + name);
    var bar = document.getElementById('res' + name + 'Bar');
    if (val) val.textContent = Math.round(pct) + '%';
    if (bar) {
      bar.style.width = pct + '%';
      setBarColor(bar, pct);
    }
  }

  function setBarColor(bar, pct) {
    bar.className = 'res-fill';
    if (pct > 85) bar.classList.add('danger');
    else if (pct > 65) bar.classList.add('warning');
  }

  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // ===== START =====
  function startDashboard() {
    initMatrix();
    renderModules();
    fetchData();
    setInterval(fetchData, POLL_INTERVAL);

    // Anime.js entrance
    if (typeof anime !== 'undefined') {
      anime({ targets: '.hero-title .line1, .hero-title .line2',
        opacity: [0,1], translateY: [30,0], delay: anime.stagger(200, {start:200}),
        easing: 'easeOutExpo', duration: 1000 });
      anime({ targets: '.kpi-card',
        opacity: [0,1], translateY: [20,0], delay: anime.stagger(100, {start:500}),
        easing: 'easeOutExpo', duration: 800 });
    }
  }
});
