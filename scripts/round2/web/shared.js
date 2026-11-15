/* Shared by every RouteGuard Round 2 page: data, vocabulary, components, contrast maths.
   build.py wraps shared.js + one page script in a single function scope. */
  const D = JSON.parse(document.getElementById('rg-data').textContent);
  const C = D.tokens.color;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (n, cls = 'ico') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };

  /* ---------------------------------------------------------------- shared vocabulary */
  const ZONE = {
    1: { name: 'Jammu → Udhampur', short: 'Jammu' },
    2: { name: 'Udhampur → Nashri', short: 'Chenani' },
    3: { name: 'Nashri → Ramban', short: 'Nashri' },
    4: { name: 'Ramban → Ramsoo', short: 'Ramban' },
    5: { name: 'Ramsoo → Qazigund', short: 'Banihal' },
    6: { name: 'Qazigund → Srinagar', short: 'Srinagar' },
  };
  const HAZ = { landslide: 'Landslide', rockfall: 'Rockfall', flash_flood: 'Flash flood', snow_ice: 'Snow / ice' };
  const HAZ_ICON = { landslide: 'hazard-landslide', rockfall: 'hazard-rockfall', flash_flood: 'hazard-flash-flood', snow_ice: 'hazard-snow-ice' };
  const ADV = {
    SEND: { cls: 'd-send', icon: 'decision-send', word: 'SEND' },
    HOLD: { cls: 'd-hold', icon: 'decision-hold', word: 'HOLD' },
    RAIL: { cls: 'd-rail', icon: 'decision-rail', word: 'RAIL' },
    DIVERT: { cls: 'd-divert', icon: 'decision-divert', word: 'DIVERT' },
  };
  const LV = { low: 0, medium: 1, high: 2 };
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const HL = { 0: 'now', 12: '+12 h', 24: '+24 h', 48: '+48 h' };
  const AT = { 0: 'right now', 12: 'at +12 h', 24: 'at +24 h', 48: 'at +48 h' };
  const SRC = {
    police: { cls: 'rp-police', label: 'Police official', icon: 'decision-hold' },
    verified: { cls: 'rp-verified', label: 'Verified driver', icon: 'decision-send' },
    unconfirmed: { cls: 'rp-unconfirmed', label: 'Unconfirmed driver', icon: 'status-offline-queue' },
  };

  /* ---------------------------------------------------------------- components (also used in Figma) */
  function decisionBanner(adv, why, extra = '') {
    const a = ADV[adv];
    return `<div class="decision ${a.cls}" data-advice="${adv}"><div class="stripe"></div><div class="body">
      <div class="head">${icon(a.icon)}<span>${a.word}</span></div>
      <div class="why">${esc(why)}</div>${extra}</div></div>`;
  }
  function levelBadge(level) {
    return `<span class="badge lv-${level}">${level === 'high' ? '▲▲ ' : level === 'medium' ? '▲ ' : ''}${esc(level)} risk</span>`;
  }
  function confBadge(conf) { return `<span class="badge cf-${conf}">${esc(conf)} confidence</span>`; }
  function zoneCard(z, r, opts = {}) {
    return `<div class="zone-card lv-${r.level}" data-zone="${z}">
      <div class="row"><strong>Zone ${z} · ${esc(ZONE[z].name)}</strong></div>
      <div class="row">${levelBadge(r.level)}${confBadge(r.confidence)}</div>
      <div class="row"><span class="score num">${r.overall.toFixed(2)}</span><span class="muted num">range ${r.risk_low.toFixed(2)} to ${r.risk_high.toFixed(2)}</span></div>
      <div style="display:flex;gap:8px;align-items:center">${icon(HAZ_ICON[r.top_hazard], 'ico sm')}<span>${esc(r.reason)}</span></div>
      ${opts.extra || ''}</div>`;
  }
  const SYNC = {
    live: { cls: 's-live', icon: 'nav-map' },
    offline: { cls: 's-offline', icon: 'status-offline-queue' },
    stale: { cls: 's-stale', icon: 'decision-hold' },
    queued: { cls: 's-queued', icon: 'status-offline-queue' },
    error: { cls: 's-error', icon: 'hazard-rockfall' },
  };
  function syncInner(kind, text) { return `${icon(SYNC[kind].icon, 'ico sm')}<span>${esc(text)}</span>`; }
  function reportPill(src, text) {
    const s = SRC[src];
    return `<span class="rpill ${s.cls}">${icon(s.icon, 'ico sm')}<span>${esc(s.label)}${text ? ': ' + esc(text) : ''}</span></span>`;
  }
  const NAV = [
    { id: 'map', label: 'Map', icon: 'nav-map' },
    { id: 'strip', label: '48h', icon: 'nav-strip' },
    { id: 'advisor', label: 'Advisor', icon: 'nav-advisor' },
    { id: 'board', label: 'Board', icon: 'nav-board' },
    { id: 'report', label: 'Report', icon: 'nav-report' },
  ];
  function bottomNav(active) {
    return NAV.map(n => `<button data-nav="${n.id}" ${n.id === active ? 'aria-current="page"' : ''}>${icon(n.icon)}<span>${n.label}</span></button>`).join('');
  }


  /* ---------------------------------------------------------------- contrast (WCAG 2.1) */
  const lum = hex => {
    const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const grade = r => (r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : r >= 3 ? 'AA large / UI' : 'fail');
