/* Clickable prototype.
   Risk rows are real job output (see the data note). Trucks, phones and road reports are sample data.
   decide() is a stand-in for lib/decide.ts: it follows the Round 1 rules, but the shelf-life and price
   values are placeholders until the team's advice table lands. */
  /* ---------------------------------------------------------------- prototype data */
  const SCEN = {
    live: { rows: D.live.rows, label: D.live.label, month: 11, when: '10 Nov 18:34 UTC', banner: 'Live · scores from the 10 Nov 18:34 UTC run' },
    replay: { rows: D.replay.rows, label: D.replay.label, month: 8, when: '25 Aug 2025 06:00 UTC', banner: 'Replay · 25 Aug 2025 06:00 UTC run' },
    daybefore: { rows: D.replay.day_before, label: 'Replay, 24 Aug 2025 06:00 UTC (a day before the closure)', month: 8, when: '24 Aug 2025 06:00 UTC', banner: 'Replay · 24 Aug 2025 06:00 UTC run' },
  };
  const SHELF = { 'Delicious': 21, 'Kullu Delicious': 18, 'Maharaji': 28, 'Ambri': 35 }; // placeholder days
  const PRICE = { 'Delicious': 60, 'Kullu Delicious': 55, 'Maharaji': 45, 'Ambri': 80 }; // placeholder Rs/kg
  const DEST = {
    azadpur: { name: 'Azadpur (Delhi)', zones: [1, 2, 3, 4, 5, 6], valley: false },
    narwal: { name: 'Narwal (Jammu)', zones: [1, 2, 3, 4, 5, 6], valley: false },
    parimpora: { name: 'Parimpora (Srinagar)', zones: [6], valley: true },
  };
  const TRUCK = { multi: 'Multi-axle (10+ wheels)', light: 'Light 6-wheeler' };
  const SAMPLE_TRUCKS = [
    { truck: 'JK03 F 2214', variety: 'Delicious', days: 12, tonnes: 10, dest: 'azadpur', type: 'multi', phone: '98•• ••• 214' },
    { truck: 'JK22 C 8810', variety: 'Kullu Delicious', days: 15, tonnes: 8, dest: 'azadpur', type: 'multi', phone: '70•• ••• 810' },
    { truck: 'JK01 AB 3301', variety: 'Maharaji', days: 5, tonnes: 6, dest: 'narwal', type: 'light', phone: '94•• ••• 301' },
    { truck: 'JK13 D 0921', variety: 'Ambri', days: 20, tonnes: 9, dest: 'parimpora', type: 'light', phone: '60•• ••• 921' },
  ];
  const SAMPLE_REPORTS = {
    live: [{ src: 'unconfirmed', hazard: 'rockfall', zone: 4, place: 'Marog', mins: 25 }],
    replay: [{ src: 'police', hazard: 'landslide', zone: 4, place: 'Digdol', mins: 40, note: 'closed both ways' },
      { src: 'verified', hazard: 'landslide', zone: 3, place: 'Seri', mins: 70 },
      { src: 'unconfirmed', hazard: 'flash_flood', zone: 3, place: 'Nashri', mins: 15 }],
    daybefore: [{ src: 'unconfirmed', hazard: 'rockfall', zone: 4, place: 'Digdol', mins: 30 }],
  };
  const GPS = { lat: 33.30284, lng: 75.17981, zone: 4, place: 'Digdol' }; // points.json z4_digdol

  const DEFAULT = () => ({
    scenario: 'live', network: 'online', edge: 'normal', role: 'grower', device: 'mobile', tab: 'map',
    horizon: 0, zone: 4, sheet: null, drawer: false,
    lot: { variety: 'Delicious', days: 12, tonnes: 10, dest: 'azadpur', type: 'multi', truck: 'JK05 G 7712' },
    advice: null, committed: [], newId: null, boardFilter: 'all',
    report: { step: 1, hazard: null, zone: null }, queue: [], sent: [], overrides: {}, pendingDone: {},
    tcu: { zone: 4, status: 'closed', hazard: 'landslide' },
  });
  let S = DEFAULT();

  function rows() {
    return SCEN[S.scenario].rows.map(r => {
      const o = S.overrides[r.zone_id];
      if (!o) return r;
      const x = { ...r, confidence: 'high' };
      if (o.status === 'closed' && r.horizon_hours <= 12) {
        // an official closure is a fact, not a forecast: score 1.00, no range
        x.level = 'high'; x.top_hazard = o.hazard; x.overall = 1; x.risk_low = 1; x.risk_high = 1;
        x[o.hazard] = 1;
        x.reason = `TCU official: zone ${r.zone_id} closed (${HAZ[o.hazard].toLowerCase()}). Score set to 1.00 and confidence to High by police.`;
      } else if (r.horizon_hours === 0) {
        x.reason = `TCU official: zone ${r.zone_id} ${o.status === 'oneway' ? 'one-way only' : 'open'}. ` + r.reason;
      }
      return x;
    });
  }
  const get = (z, h) => rows().find(r => r.zone_id === z && r.horizon_hours === h);

  function decide(lot) {
    const d = DEST[lot.dest];
    let w = null;
    for (const z of d.zones) for (const h of [0, 12, 24]) {
      const r = get(z, h);
      if (!w || LV[r.level] > LV[w.level] || (LV[r.level] === LV[w.level] && r.overall > w.overall && r.level !== 'low')) w = { ...r, z, h };
    }
    const highZones = d.zones.filter(z => get(z, 24).level === 'high' && get(z, 48).level === 'high');
    const shut48 = highZones.length > 0;
    const spoil = Math.min(1, lot.days / SHELF[lot.variety]);
    const value = lot.tonnes * PRICE[lot.variety] / 100; // lakh rupees
    const priority = +(spoil * value).toFixed(2);
    const month = SCEN[S.scenario].month;
    let advice, why, delay;
    const zn = `zone ${w.z} (${ZONE[w.z].name})`;
    if (w.level === 'low') {
      advice = 'SEND'; delay = 'none expected';
      why = `${d.zones.length === 1 ? 'Zone ' + d.zones[0] + ' on your route stays' : 'All ' + d.zones.length + ' zones on your route stay'} low for 24 h. Leave in the next 12 h.`;
    } else if (w.level === 'medium') {
      if (lot.type === 'light' && !d.valley && month >= 5 && month <= 11) {
        advice = 'DIVERT'; delay = '+4 h (longer road)';
        why = `${cap(zn)} is medium ${AT[w.h]}. A light truck can take Mughal Road (Shopian to Bufliaz) instead of NH-44.`;
      } else {
        advice = 'HOLD'; delay = '+6 h';
        why = `${cap(zn)} is medium ${AT[w.h]}. Wait 6 h and check again before loading.`;
      }
    } else if (shut48 && !d.valley && spoil >= 0.5) {
      advice = 'RAIL'; delay = '+24 h by road, rail avoids it';
      why = `Zone${highZones.length > 1 ? 's' : ''} ${highZones.join(', ')} stay high at +24 h and +48 h, and this fruit has used ${Math.round(spoil * 100)}% of its shelf life. Book a Budgam–Delhi parcel train slot.`;
    } else {
      advice = 'DIVERT'; delay = '+24 h by road';
      why = d.valley ? `${cap(zn)} is high ${AT[w.h]}. Keep the lot at a CA store near Pulwama until it clears.`
        : `${cap(zn)} is high ${AT[w.h]}. The fruit can wait: send it to a CA store in the valley or sell at Parimpora.`;
    }
    return { advice, why, delay, priority, spoil, value, worst: w, conf: w.confidence, shut48 };
  }

  function boardList() {
    const all = [...SAMPLE_TRUCKS.map((t, i) => ({ ...t, id: 's' + i, sample: true })), ...S.committed];
    return all.map(t => ({ ...t, d: decide(t) })).sort((a, b) => b.d.priority - a.d.priority);
  }
  function reports() {
    const base = SAMPLE_REPORTS[S.scenario].map((r, i) => ({ ...r, id: 'r' + i, sample: true }));
    const tcu = Object.entries(S.overrides).map(([z, o]) => ({ id: 'tcu' + z, src: 'police', hazard: o.hazard, zone: +z, place: ZONE[z].short, mins: 0, note: { closed: 'closed', oneway: 'one-way', open: 'open' }[o.status] }));
    const sent = S.sent.map(r => ({ ...r, src: S.pendingDone[r.id] === 'ok' ? 'verified' : 'unconfirmed' }));
    return [...tcu, ...sent.filter(r => S.pendingDone[r.id] !== 'no'), ...base.map(r => S.pendingDone[r.id] === 'ok' ? { ...r, src: 'verified' } : r).filter(r => S.pendingDone[r.id] !== 'no')];
  }
  function cacheBytes() {
    const slim = rows().map(r => [r.zone_id, r.horizon_hours, r.level[0], +r.overall.toFixed(2), r.confidence[0], r.top_hazard]);
    return new TextEncoder().encode(JSON.stringify({ run: SCEN[S.scenario].when, rows: slim })).length;
  }

  /* ---------------------------------------------------------------- map */
  const PTS = [...D.points].sort((a, b) => a.km_from_jammu - b.km_from_jammu);
  const MAP = (() => {
    const W = 358, H = 380, lat0 = 33.4, k = 262;
    const latMax = Math.max(...PTS.map(p => p.lat)) + 0.03, lngMid = (Math.max(...PTS.map(p => p.lng)) + Math.min(...PTS.map(p => p.lng))) / 2;
    const xy = (lat, lng) => [150 + (lng - lngMid) * k * Math.cos(lat0 * Math.PI / 180), 14 + (latMax - lat) * k];
    const pts = PTS.map(p => ({ ...p, xy: xy(p.lat, p.lng) }));
    const r = 6.5, hw = Math.sqrt(3) * r;
    const segDist = (p, a, b) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L));
      return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
    };
    const hexes = [];
    for (let row = 0; row * 1.5 * r < H; row++) for (let col = -1; col * hw < W; col++) {
      const c = [col * hw + (row % 2 ? hw / 2 : 0), row * 1.5 * r];
      let best = 1e9;
      for (let i = 0; i < pts.length - 1; i++) best = Math.min(best, segDist(c, pts[i].xy, pts[i + 1].xy));
      if (best > r * 1.7) continue;
      let near = pts[0], nd = 1e9;
      pts.forEach(p => { const dd = Math.hypot(p.xy[0] - c[0], p.xy[1] - c[1]); if (dd < nd) { nd = dd; near = p; } });
      const poly = [0, 1, 2, 3, 4, 5].map(i => { const a = Math.PI / 180 * (60 * i - 30); return `${(c[0] + r * Math.cos(a)).toFixed(1)},${(c[1] + r * Math.sin(a)).toFixed(1)}`; }).join(' ');
      hexes.push({ zone: near.zone_id, poly, c });
    }
    return { W, H, xy, pts, hexes };
  })();
  const LABELS = [['z1_nagrota', 'Jammu (Nagrota)'], ['z2_chenani', 'Chenani'], ['z4_ramban', 'Ramban'], ['z4_digdol', 'Digdol'], ['z5_banihal', 'Banihal'], ['z5_qazigund', 'Qazigund'], ['z6_srinagar', 'Srinagar']];
  function mapSvg(h, big) {
    const fill = { low: C['risk.low.map'], medium: C['risk.medium.map'], high: C['risk.high.map'] };
    const lv = {}; for (let z = 1; z <= 6; z++) lv[z] = get(z, h).level;
    const hexes = MAP.hexes.map(x => `<polygon class="hex${x.zone === S.zone ? ' sel' : ''}" data-zone="${x.zone}" points="${x.poly}" fill="${fill[lv[x.zone]]}"/>`
      + (lv[x.zone] !== 'low' ? `<polygon points="${x.poly}" fill="url(#pat-${lv[x.zone]})" pointer-events="none"/>` : '')).join('');
    const route = `<polyline points="${MAP.pts.map(p => p.xy.map(v => v.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="#FFFFFF" stroke-width="1.5" stroke-dasharray="3 3" pointer-events="none"/>`;
    const labels = LABELS.map(([id, t]) => { const p = MAP.pts.find(q => q.id === id); const left = id === 'z6_srinagar';
      return `<text x="${(p.xy[0] + (left ? -14 : 22)).toFixed(1)}" y="${(p.xy[1] + 4).toFixed(1)}" text-anchor="${left ? 'end' : 'start'}" font-size="12" font-weight="600" fill="${C['text.primary']}">${esc(t)}</text>`; }).join('');
    const pins = reports().map((r, i) => { const p = MAP.pts.filter(q => q.zone_id === r.zone)[i % MAP.pts.filter(q => q.zone_id === r.zone).length]; const c = r.src === 'police' ? C['rail.fill'] : r.src === 'verified' ? C['send.fill'] : C['text.secondary'];
      return `<g pointer-events="none" transform="translate(${(p.xy[0] - 40).toFixed(1)},${(p.xy[1] - 10).toFixed(1)})"><rect width="20" height="20" rx="10" fill="#FFFFFF" stroke="${c}" stroke-width="2" ${r.src === 'unconfirmed' ? 'stroke-dasharray="3 2"' : ''}/><use href="#i-${HAZ_ICON[r.hazard]}" x="3" y="3" width="14" height="14" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></g>`; }).join('');
    return `<svg viewBox="0 0 ${MAP.W} ${MAP.H}" ${big ? 'style="height:100%;width:auto;max-width:100%"' : ''} role="img" aria-label="NH-44 risk map at ${HL[h]}. ${[1, 2, 3, 4, 5, 6].map(z => `Zone ${z} ${lv[z]}`).join(', ')}.">
      <defs><pattern id="pat-medium" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="6" fill="rgba(255,255,255,.45)"/></pattern>
      <pattern id="pat-high" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M0 0 5 5M5 0 0 5" stroke="rgba(255,255,255,.5)" stroke-width="1.2"/></pattern></defs>
      ${hexes}${route}${labels}${pins}</svg>`;
  }

  /* ---------------------------------------------------------------- prototype screens */
  const ROLE = { grower: 'Grower / Trader', agent: 'Transport Agent', driver: 'Truck Driver', police: 'Traffic Police (TCU)' };
  const ROLE_TAB = { grower: 'map', agent: 'board', driver: 'report', police: 'report' };
  const TITLES = { map: 'Risk map', strip: '48-hour strip', advisor: 'Dispatch advisor', board: 'Shipment board', report: 'Report a hazard' };
  const horizonChips = () => `<div class="scroll-x" role="group" aria-label="Forecast time">${[0, 12, 24, 48].map(h => `<button class="chip" data-h="${h}" aria-pressed="${S.horizon === h}">${h === 0 ? 'Now' : HL[h]}</button>`).join('')}</div>`;
  const legend = () => `<div class="legend" aria-hidden="true"><span><i style="background:${C['risk.low.map']}"></i>Low</span><span><i style="background:${C['risk.medium.map']};background-image:repeating-linear-gradient(45deg,transparent 0 3px,rgba(255,255,255,.5) 3px 5px)"></i>Medium</span><span><i style="background:${C['risk.high.map']};background-image:repeating-linear-gradient(45deg,transparent 0 2px,rgba(255,255,255,.5) 2px 3px),repeating-linear-gradient(-45deg,transparent 0 2px,rgba(255,255,255,.5) 2px 3px)"></i>High</span></div>`;
  const zoneButtons = h => `<div class="zone-btns">${[1, 2, 3, 4, 5, 6].map(z => { const r = get(z, h); return `<button class="zbtn lv-${r.level}" data-zone="${z}" aria-label="Zone ${z} ${ZONE[z].name}: ${r.level} risk ${r.overall.toFixed(2)}">Z${z} ${esc(ZONE[z].short)}<span class="num">${r.level.toUpperCase()} ${r.overall.toFixed(2)}</span></button>`; }).join('')}</div>`;
  const reportList = () => { const rs = reports(); return rs.length ? `<div class="label">Road reports (sample)</div><div class="stack">${rs.map(r => `<div>${reportPill(r.src, `${HAZ[r.hazard].toLowerCase()} at ${r.place}${r.note ? ', ' + r.note : ''} · ${r.mins ? r.mins + ' min ago' : 'just now'}`)}</div>`).join('')}</div>` : ''; };

  function scrMap() {
    const h = S.horizon;
    return `${horizonChips()}<div class="mapbox">${mapSvg(h)}</div>${legend()}
      <p class="muted" style="margin:0">Cells are drawn along the route for this prototype; the app uses H3 cells from our corridor file.</p>
      ${zoneButtons(h)}${reportList()}`;
  }
  function scrStrip() {
    let w = null; rows().forEach(r => { if (!w || LV[r.level] > LV[w.level] || (r.level === w.level && r.overall > w.overall)) w = r; });
    const head = w.level === 'low' ? `All 6 zones stay low for 48 h. Worst: zone ${w.zone_id} at ${w.overall.toFixed(2)} (${HL[w.horizon_hours]}).`
      : `Worst on the route: zone ${w.zone_id} (${ZONE[w.zone_id].short}) is ${w.level} ${AT[w.horizon_hours]}.`;
    return `<div class="card sand" style="padding:12px"><strong>${esc(head)}</strong></div>
      <table class="strip"><thead><tr><th class="z" scope="col">Zone</th>${[0, 12, 24, 48].map(h => `<th scope="col">${h === 0 ? 'Now' : HL[h]}</th>`).join('')}</tr></thead><tbody>
      ${[1, 2, 3, 4, 5, 6].map(z => `<tr><th class="z" scope="row">${z} ${esc(ZONE[z].short)}</th>${[0, 12, 24, 48].map(h => { const r = get(z, h);
        return `<td><button class="cellbtn lv-${r.level}" data-zone="${z}" data-h="${h}" aria-label="Zone ${z} at ${HL[h]}: ${r.level} risk ${r.overall.toFixed(2)}"><span>${r.overall.toFixed(2)}</span><span class="lv">${r.level === 'medium' ? 'med' : r.level}</span></button></td>`; }).join('')}</tr>`).join('')}
      </tbody></table><p class="muted" style="margin:0">Medium cells have stripes and high cells cross-hatching, so the level reads without colour. Tap a cell to see why.</p>`;
  }
  function scrAdvisor() {
    const l = S.lot;
    if (S.advice) {
      const a = S.advice;
      return `${decisionBanner(a.advice, a.why)}
        <div class="label">Zone that drives this</div>${zoneCard(a.worst.z, a.worst)}
        <div class="grid" style="grid-template-columns:1fr 1fr;gap:8px">
          <div class="card" style="padding:12px"><div class="label">Expected delay</div><strong>${esc(a.delay)}</strong></div>
          <div class="card" style="padding:12px"><div class="label">Priority</div><strong class="num">${a.priority.toFixed(2)}</strong><div class="muted">${Math.round(a.spoil * 100)}% shelf life × Rs ${a.value.toFixed(1)} lakh</div></div></div>
        <p class="muted" style="margin:0">${esc(l.tonnes + ' t ' + l.variety + ', picked ' + l.days + ' days ago, to ' + DEST[l.dest].name + ', ' + TRUCK[l.type].toLowerCase())}. Placeholder shelf-life and price values until our advice table lands.</p>
        <button class="btn primary" id="commit" style="width:100%">${icon('nav-board')}Commit ${esc(l.truck)} to board</button>
        <button class="btn" id="change" style="width:100%">Change lot</button>`;
    }
    const radio = (name, opts, cur) => `<div class="radio-cards" role="radiogroup">${Object.entries(opts).map(([v, t]) => `<label><input type="radio" name="${name}" value="${v}" ${v === cur ? 'checked' : ''}><span>${esc(t)}</span></label>`).join('')}</div>`;
    return `<form class="form" id="lotform" novalidate>
      <label class="field"><span>Variety</span><select name="variety">${Object.keys(SHELF).map(v => `<option ${v === l.variety ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <div class="grid" style="grid-template-columns:1fr 1fr;gap:8px">
        <label class="field"><span>Days since picking</span><input type="number" name="days" min="0" max="60" inputmode="numeric" value="${l.days}"></label>
        <label class="field"><span>Tonnes</span><input type="number" name="tonnes" min="1" max="30" inputmode="decimal" value="${l.tonnes}"></label></div>
      <div class="field"><span>Destination</span>${radio('dest', Object.fromEntries(Object.entries(DEST).map(([k, v]) => [k, v.name])), l.dest)}</div>
      <div class="field"><span>Truck</span>${radio('type', TRUCK, l.type)}</div>
      <label class="field"><span>Truck number</span><input type="text" name="truck" value="${esc(l.truck)}" autocomplete="off"></label>
      <button class="btn primary" type="submit" id="getadvice" style="width:100%">${icon('nav-advisor')}Get advice</button></form>`;
  }
  function shipCard(t, i) {
    const a = ADV[t.d.advice];
    return `<article class="ship${t.id === S.newId ? ' new' : ''}" data-ship="${esc(t.id)}"><div class="top"><span class="rank">#${i + 1}</span><strong class="num">${esc(t.truck)}</strong><span class="badge" style="--c-bg:var(--${t.d.advice.toLowerCase()}-bg);--c-text:var(--${t.d.advice.toLowerCase()}-text)">${icon(a.icon, 'ico sm')}${a.word}</span></div>
      <div class="kv"><span>${t.tonnes} t ${esc(t.variety)}</span><span>to ${esc(DEST[t.dest].name)}</span><span>priority <span class="num">${t.d.priority.toFixed(2)}</span></span><span>driver ${esc(t.phone)}</span></div>
      <div class="muted">${esc(t.d.why)}</div>${t.sample ? '' : '<span class="pill ok" style="justify-self:start">just committed</span>'}</article>`;
  }
  function scrBoard() {
    const list = boardList().filter(t => S.boardFilter === 'all' || (S.boardFilter === 'moving' ? ['SEND', 'RAIL', 'DIVERT'].includes(t.d.advice) : t.d.advice === 'HOLD'));
    const tabs = `<div class="tabrow" role="tablist" aria-label="Filter trucks">${[['all', 'All'], ['moving', 'Moving'], ['held', 'Held']].map(([k, t]) => `<button role="tab" data-filter="${k}" aria-selected="${S.boardFilter === k}">${t}</button>`).join('')}</div>`;
    const body = list.length ? list.map(shipCard).join('') : `<div class="empty">${icon('nav-board')}<strong>No trucks in this filter</strong></div>`;
    return `${tabs}<p class="muted" style="margin:0">Ranked by priority = spoilage × load value. Sample trucks and masked phones.</p><div class="stack">${body}</div>`;
  }
  function scrReport() {
    if (S.role === 'police') return scrTcu();
    const rp = S.report;
    const steps = `<div class="steps" aria-label="Step ${rp.step} of 3">${[1, 2, 3].map(i => `<span class="${i <= rp.step ? 'on' : ''}"></span>`).join('')}</div>`;
    if (rp.step === 1) {
      return `${steps}<h3 style="margin:0">What did you see?</h3><div class="hazgrid">${Object.entries(HAZ).map(([k, t]) => `<button class="hazbtn" data-haz="${k}" aria-pressed="${rp.hazard === k}">${icon(HAZ_ICON[k])}<span>${t}</span></button>`).join('')}</div>
        <div class="callout" style="margin:0">${S.network === 'offline' ? 'No signal right now. Your report will wait on this phone and send by itself.' : 'Reports reach the TCU control room and drivers behind you.'}</div>`;
    }
    if (rp.step === 2) {
      const gpsOff = S.edge === 'error';
      const where = gpsOff
        ? `<div class="callout warn" style="margin:0"><strong>Location is off.</strong> Pick the zone you are in.</div><div class="scroll-x">${[1, 2, 3, 4, 5, 6].map(z => `<button class="chip" data-rzone="${z}" aria-pressed="${rp.zone === z}">Z${z} ${esc(ZONE[z].short)}</button>`).join('')}</div>`
        : `<div class="card" style="padding:12px"><div class="label">Your location (GPS)</div><div class="coords">${GPS.lat.toFixed(5)}, ${GPS.lng.toFixed(5)}</div><div>Near ${GPS.place}, zone ${GPS.zone} (${esc(ZONE[GPS.zone].name)})</div></div>`;
      return `${steps}<h3 style="margin:0">${icon(HAZ_ICON[rp.hazard], 'ico sm')} ${HAZ[rp.hazard]}: where?</h3><div class="photo">Add a photo (optional)</div>${where}
        <button class="btn report" id="rp-place" style="width:100%" ${gpsOff && !rp.zone ? 'disabled' : ''}>This is the place</button><button class="btn" id="rp-back" style="width:100%">Back</button>`;
    }
    const z = rp.zone || GPS.zone;
    return `${steps}<h3 style="margin:0">Send this report?</h3><div class="card" style="padding:12px;display:grid;gap:6px">${reportPill('unconfirmed', HAZ[rp.hazard].toLowerCase())}<div>Zone ${z}, ${esc(rp.zone ? ZONE[z].short : GPS.place)}</div><div class="muted">It shows as unconfirmed until police or a second driver confirms it.</div></div>
      <button class="btn report" id="rp-send" style="width:100%">${icon('nav-report')}${S.network === 'offline' ? 'Save and send when online' : 'Send report'}</button><button class="btn" id="rp-back" style="width:100%">Back</button>`;
  }
  function scrTcu() {
    const t = S.tcu;
    const pend = reports().filter(r => r.src === 'unconfirmed');
    return `<div class="label">TCU official advisory</div>
      <form class="form" id="tcuform">
        <label class="field"><span>Zone</span><select name="zone">${[1, 2, 3, 4, 5, 6].map(z => `<option value="${z}" ${z === t.zone ? 'selected' : ''}>Zone ${z} · ${ZONE[z].name}</option>`).join('')}</select></label>
        <div class="field"><span>Road status</span><div class="radio-cards" role="radiogroup">${[['closed', 'Closed both ways'], ['oneway', 'One-way only'], ['open', 'Open']].map(([v, l]) => `<label><input type="radio" name="status" value="${v}" ${v === t.status ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
        <label class="field"><span>Cause</span><select name="hazard">${Object.entries(HAZ).map(([k, v]) => `<option value="${k}" ${k === t.hazard ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <button class="btn navy" type="submit" id="tcu-publish" style="width:100%">Publish and alert drivers in zone</button></form>
      <div class="label">Driver reports waiting (${pend.length})</div>
      <div class="stack">${pend.length ? pend.map(r => `<div class="ship"><div>${reportPill('unconfirmed', `${HAZ[r.hazard].toLowerCase()} at ${r.place}`)}</div><div class="grid" style="grid-template-columns:1fr 1fr;gap:8px"><button class="btn" data-confirm="${r.id}">Confirm</button><button class="btn" data-reject="${r.id}">Reject</button></div></div>`).join('') : '<p class="muted">No reports waiting.</p>'}</div>`;
  }

  function skeleton() { return `<div class="skel" style="height:48px"></div><div class="skel" style="height:300px"></div><div class="skel" style="height:56px"></div><div class="skel" style="height:56px"></div><p class="muted" role="status" style="margin:0">Loading the latest scores…</p>`; }
  function emptyState() {
    const E = {
      map: ['nav-map', 'No scores for this hour yet', 'The hourly job runs at 5 past the hour. Last scores will show here.', 'Check again', 'retry'],
      strip: ['nav-strip', 'No forecast to show', 'The 48-hour strip fills after the next run.', 'Check again', 'retry'],
      advisor: ['nav-advisor', 'No lots yet', 'Add your first lot to get advice.', 'Add a lot', 'normal'],
      board: ['nav-board', 'No trucks on the board', 'Commit a lot from the advisor and it shows here, ranked.', 'Plan a lot', 'advisor'],
      report: ['nav-report', 'No reports from your zone', 'Seen debris or water on the road? Report it in 3 taps.', 'Report a hazard', 'normal'],
    }[S.tab];
    return `<div class="empty">${icon(E[0])}<strong>${E[1]}</strong><p class="muted" style="margin:0">${E[2]}</p><button class="btn primary" data-empty="${E[4]}">${E[3]}</button></div>`;
  }
  function errorState() {
    if (S.tab === 'report' && S.role !== 'police') return null; // report shows the GPS-denied fallback instead
    return `<div class="empty">${icon('hazard-rockfall')}<strong>Can't reach RouteGuard</strong><p class="muted" style="margin:0">Showing nothing rather than old scores as new. Check your signal and try again, or open the offline copy.</p>
      <button class="btn primary" data-empty="retry">Try again</button><button class="btn" data-open="drawer">Open offline copy</button></div>`;
  }

  function bannerState() {
    if (S.edge === 'error' && !(S.tab === 'report' && S.role !== 'police')) return ['error', 'Can\'t reach the server · tap to retry'];
    const q = S.queue.length;
    if (S.network === 'offline') return q ? ['queued', `Offline · ${q} report${q > 1 ? 's' : ''} waiting to send`] : ['offline', `Offline · cached scores from 2 h ago, ${(cacheBytes() / 1024).toFixed(1)} KB`];
    if (S.network === 'stale') return ['stale', 'Scores are 3 h old · the hourly job missed a run'];
    return ['live', SCEN[S.scenario].banner];
  }

  function sheetZone() {
    const z = S.sheet.zone, h = S.sheet.h ?? S.horizon, r = get(z, h);
    const bars = Object.entries(HAZ).map(([k, t]) => `<div class="b"><span>${t}</span><div class="track"><div class="fill" style="width:${Math.round(r[k] * 100)}%"></div></div><span class="num">${r[k].toFixed(2)}</span></div>`).join('');
    const inc = D.incidents.filter(i => +i.zone_id === z);
    return `<div class="grab"></div><div class="sh-head"><h3 id="sheet-title" style="margin:0">Zone ${z} · ${h === 0 ? 'now' : HL[h]}</h3><button class="btn ghost" data-close aria-label="Close">✕</button></div>
      ${zoneCard(z, r)}
      <div class="label">Hazard scores</div><div class="bars">${bars}</div>
      <div class="label">Outlook</div><div class="scroll-x">${[0, 12, 24, 48].map(hh => `<button class="chip" data-sh="${hh}" aria-pressed="${hh === h}">${hh === 0 ? 'Now' : HL[hh]} ${get(z, hh).level === 'high' ? '▲▲' : get(z, hh).level === 'medium' ? '▲' : '·'}</button>`).join('')}</div>
      <div class="label">Past closures here (incidents.csv)</div>
      ${inc.length ? `<ul style="margin:0;padding-left:20px">${inc.map(i => `<li>${esc(i.date)}: ${esc(i.place)}, ${esc(HAZ[i.hazard_type] || i.hazard_type).toLowerCase()}, closed ${esc(i.hours_closed)} h, ${esc(i.trucks_stranded)} trucks</li>`).join('')}</ul>` : '<p class="muted" style="margin:0">None logged yet.</p>'}
      <button class="btn primary" data-plan style="width:100%">Plan a lot through this zone</button>`;
  }
  function sheetDrawer() {
    const kb = (cacheBytes() / 1024).toFixed(1);
    const q = S.queue;
    return `<div class="grab"></div><div class="sh-head"><h3 id="sheet-title" style="margin:0">Offline and sync</h3><button class="btn ghost" data-close aria-label="Close">✕</button></div>
      <div class="sync ${SYNC[bannerState()[0]].cls}" style="border-radius:8px">${syncInner(...bannerState())}</div>
      <div class="card" style="padding:12px;display:grid;gap:4px"><div class="label">Cached on this phone</div>
        <div>${rows().length} zone scores (6 zones × 4 times) from the ${esc(SCEN[S.scenario].when)} run</div>
        <div><span class="num">${kb} KB</span> · budget under 5 KB, so it loads on 2G</div></div>
      <div class="label">Reports waiting (${q.length})</div>
      ${q.length ? `<div class="stack">${q.map(r => `<div>${reportPill('unconfirmed', `${HAZ[r.hazard].toLowerCase()}, zone ${r.zone}`)}</div>`).join('')}</div>` : '<p class="muted" style="margin:0">Nothing waiting.</p>'}
      <button class="btn primary" id="sendnow" style="width:100%" ${S.network === 'offline' || !q.length ? 'disabled' : ''}>Send now</button>
      <div class="label">Works offline</div><ul style="margin:0;padding-left:20px"><li>Map and 48-hour strip from the cached scores</li><li>Advisor on the cached scores, marked as cached</li><li>Reports, queued until there is signal</li></ul>`;
  }

  /* ---------------------------------------------------------------- desktop control room */
  function desktop() {
    const h = S.horizon;
    const strip = `<table class="strip"><thead><tr><th class="z">Zone</th>${[0, 12, 24, 48].map(x => `<th>${x === 0 ? 'Now' : HL[x]}</th>`).join('')}</tr></thead><tbody>${[1, 2, 3, 4, 5, 6].map(z => `<tr><th class="z">${z} ${esc(ZONE[z].short)}</th>${[0, 12, 24, 48].map(x => { const r = get(z, x); return `<td><button class="cellbtn lv-${r.level}" data-zone="${z}" data-h="${x}"><span>${r.overall.toFixed(2)}</span><span class="lv">${r.level}</span></button></td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
    const board = `<table class="t" style="font-size:13px"><thead><tr><th>#</th><th>Truck</th><th>Lot</th><th>To</th><th>Advice</th><th>Priority</th></tr></thead><tbody>${boardList().map((t, i) => `<tr><td>${i + 1}</td><td class="num" style="white-space:nowrap">${esc(t.truck)}</td><td>${t.tonnes} t ${esc(t.variety)}</td><td>${esc(DEST[t.dest].name)}</td><td><span class="badge" style="--c-bg:var(--${t.d.advice.toLowerCase()}-bg);--c-text:var(--${t.d.advice.toLowerCase()}-text)">${t.d.advice}</span></td><td class="num">${t.d.priority.toFixed(2)}</td></tr>`).join('')}</tbody></table>`;
    const [bk, bt] = bannerState();
    return `<div class="desk"><div class="dhead"><div style="display:flex;gap:12px;align-items:center">${icon('nav-map')}<strong style="font:700 20px var(--f-display)">RouteGuard control room</strong><span>NH-44 Jammu to Srinagar · ${esc(ROLE[S.role])} view</span></div>
      <div class="sync ${SYNC[bk].cls}" style="max-width:520px;border-radius:8px">${syncInner(bk, bt)}</div></div>
      <div class="dbody"><div class="col"><div class="label">Risk map · ${h === 0 ? 'now' : HL[h]}</div>${horizonChips()}<div class="mapbox" style="height:560px;display:grid;place-items:center">${mapSvg(h, true)}</div>${legend()}</div>
      <div class="col"><div class="label">48-hour strip</div>${strip}<div class="label">Shipment board (sample trucks)</div>${board}</div>
      <div class="col">${reportList() || '<div class="label">Road reports</div><p class="muted">No reports.</p>'}<div class="label">Most at-risk zone</div>${(() => { let w = 1; for (let z = 1; z <= 6; z++) if (get(z, h).overall > get(w, h).overall) w = z; return zoneCard(w, get(w, h)); })()}</div></div></div>`;
  }

  /* ---------------------------------------------------------------- render */
  const phone = $('#phone'), stage = $('#stage');
  let deskEl = null;
  function render() {
    ['scenario', 'network', 'edge', 'role', 'device'].forEach(k => { $('#sim-' + k).value = S[k]; });
    $('#data-note').textContent = `${SCEN[S.scenario].label}. ${S.scenario === 'live' ? D.live.source : D.replay.source}. Trucks, phones and road reports are sample data. Advice uses placeholder shelf-life and price values.`;
    if (S.device === 'desktop') {
      phone.style.display = 'none';
      if (!deskEl) { deskEl = document.createElement('div'); stage.appendChild(deskEl); }
      deskEl.innerHTML = desktop();
      stage.classList.add('desktop-mode');
      $('.proto-layout').style.gridTemplateColumns = '1fr';
      return;
    }
    phone.style.display = '';
    if (deskEl) { deskEl.remove(); deskEl = null; }
    stage.classList.remove('desktop-mode');
    $('.proto-layout').style.gridTemplateColumns = '';
    $('#ab-title').textContent = S.role === 'police' && S.tab === 'report' ? 'TCU console' : TITLES[S.tab];
    $('#ab-role').textContent = ROLE[S.role];
    const [bk, bt] = bannerState();
    const ban = $('#banner'); ban.className = 'sync ' + SYNC[bk].cls; ban.innerHTML = syncInner(bk, bt);
    $('#bnav').innerHTML = bottomNav(S.tab);
    const scr = $('#screen');
    let html;
    if (S.edge === 'loading') html = skeleton();
    else if (S.edge === 'empty') html = emptyState();
    else if (S.edge === 'error' && errorState()) html = errorState();
    else html = { map: scrMap, strip: scrStrip, advisor: scrAdvisor, board: scrBoard, report: scrReport }[S.tab]();
    scr.innerHTML = html;
    const sh = $('#sheet');
    if (S.sheet || S.drawer) { sh.innerHTML = S.drawer ? sheetDrawer() : sheetZone(); phone.classList.add('open'); sh.removeAttribute('aria-hidden'); }
    else { phone.classList.remove('open'); sh.innerHTML = ''; sh.setAttribute('aria-hidden', 'true'); }
  }
  let toastT;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }

  function flushQueue() {
    if (!S.queue.length || S.network === 'offline') return 0;
    const n = S.queue.length;
    S.sent.push(...S.queue.map(r => ({ ...r, mins: 0 })));
    S.queue = [];
    toast(`${n} queued report${n > 1 ? 's' : ''} sent`);
    return n;
  }
  function readLot() {
    const f = $('#lotform'); if (!f) return;
    const fd = new FormData(f);
    S.lot = { variety: fd.get('variety'), days: Math.max(0, +fd.get('days') || 0), tonnes: Math.max(1, +fd.get('tonnes') || 1), dest: fd.get('dest'), type: fd.get('type'), truck: (fd.get('truck') || 'JK05 G 7712').toString().trim() || 'JK05 G 7712' };
  }

  /* events: one delegated listener on the phone and the desktop view */
  function onClick(e) {
    phone.classList.remove('instant');
    const t = e.target.closest('button, polygon.hex');
    if (!t) { if (e.target.id === 'scrim') { S.sheet = null; S.drawer = false; render(); } return; }
    const d = t.dataset;
    if (d.nav) { S.tab = d.nav; S.sheet = null; S.drawer = false; if (d.nav === 'report' && S.report.step > 3) S.report = { step: 1, hazard: null, zone: null }; }
    else if (t.id === 'banner' || t.id === 'ab-sync' || d.open === 'drawer') { if (S.edge === 'error' && t.id === 'banner') { S.edge = 'normal'; toast('Connected again'); } else S.drawer = true; }
    else if (d.close !== undefined) { S.sheet = null; S.drawer = false; }
    else if (d.h !== undefined && d.zone) { S.zone = +d.zone; S.sheet = { type: 'zone', zone: +d.zone, h: +d.h }; }
    else if (d.h !== undefined) S.horizon = +d.h;
    else if (d.sh !== undefined) S.sheet.h = +d.sh;
    else if (d.zone) { S.zone = +d.zone; S.sheet = { type: 'zone', zone: +d.zone }; }
    else if (d.plan !== undefined) { S.sheet = null; S.tab = 'advisor'; S.advice = null; }
    else if (d.filter) S.boardFilter = d.filter;
    else if (d.haz) { S.report.hazard = d.haz; S.report.step = 2; }
    else if (d.rzone) S.report.zone = +d.rzone;
    else if (t.id === 'rp-place') S.report.step = 3;
    else if (t.id === 'rp-back') S.report.step = Math.max(1, S.report.step - 1);
    else if (t.id === 'rp-send') {
      const r = { id: 'u' + Date.now() + Math.random().toString(16).slice(2, 6), hazard: S.report.hazard, zone: S.report.zone || GPS.zone, place: S.report.zone ? ZONE[S.report.zone].short : GPS.place, src: 'unconfirmed' };
      if (S.network === 'offline') { S.queue.push(r); toast('Saved on this phone. It sends when you have signal.'); }
      else { S.sent.push({ ...r, mins: 0 }); toast('Report sent to the TCU control room'); }
      S.report = { step: 1, hazard: null, zone: null }; S.tab = 'map';
    }
    else if (t.id === 'sendnow') flushQueue();
    else if (t.id === 'commit') {
      const id = 'c' + (S.committed.length + 1);
      S.committed.push({ ...S.lot, id, phone: '99•• ••• 000' });
      S.newId = id; S.advice = null; S.tab = 'board'; S.boardFilter = 'all';
      const rank = boardList().findIndex(x => x.id === id) + 1;
      toast(`${S.lot.truck} added to the board at #${rank}`);
    }
    else if (t.id === 'change') S.advice = null;
    else if (d.confirm) S.pendingDone[d.confirm] = 'ok';
    else if (d.reject) S.pendingDone[d.reject] = 'no';
    else if (d.empty) { if (d.empty === 'advisor') { S.tab = 'advisor'; } S.edge = 'normal'; }
    else if (t.tagName === 'polygon') { S.zone = +t.dataset.zone; S.sheet = { type: 'zone', zone: S.zone }; }
    else return;
    render();
  }
  function onSubmit(e) {
    e.preventDefault();
    if (e.target.id === 'lotform') { readLot(); S.advice = decide(S.lot); }
    if (e.target.id === 'tcuform') {
      const fd = new FormData(e.target);
      const z = +fd.get('zone');
      S.tcu = { zone: z, status: fd.get('status'), hazard: fd.get('hazard') };
      S.overrides[z] = { status: S.tcu.status, hazard: S.tcu.hazard };
      S.zone = z;
      toast(`Published. Zone ${z} confidence is now High; drivers in zone ${z} get a push alert.`);
    }
    render();
  }
  stage.addEventListener('click', onClick); // one listener: the phone and the desktop view both live in #stage
  phone.addEventListener('submit', onSubmit);
  phone.addEventListener('keydown', e => { if (e.key === 'Escape' && (S.sheet || S.drawer)) { S.sheet = null; S.drawer = false; render(); } });
  ['scenario', 'network', 'edge', 'role', 'device'].forEach(k => $('#sim-' + k).addEventListener('change', e => {
    S[k] = e.target.value;
    if (k === 'role') { S.tab = ROLE_TAB[S.role]; S.sheet = null; S.drawer = false; }
    if (k === 'scenario') { S.advice = S.advice ? decide(S.lot) : null; S.overrides = {}; S.pendingDone = {}; }
    if (k === 'network') flushQueue();
    render();
  }));

  /* ---------------------------------------------------------------- test hooks used by scripts/verify_round2_all.py */
  function applyState(st) {
    S = DEFAULT();
    if (!st || st.name === 'reset') { render(); return true; }
    Object.entries(st).forEach(([k, v]) => { if (k in S && k !== 'report') S[k] = v; });
    if (st.role && !st.tab) S.tab = ROLE_TAB[st.role];
    if (st.report) S.report = { ...S.report, ...st.report };
    if (st.queue) S.queue = st.queue.map((r, i) => ({ id: 'q' + i, src: 'unconfirmed', ...r }));
    if (st.run) S.advice = decide(S.lot);
    if (st.override) S.overrides = st.override;
    phone.classList.add('instant');
    render();
    return true;
  }
  const AUDIT = [
    { name: 'map_live', tab: 'map' },
    { name: 'map_replay_plus24', scenario: 'replay', tab: 'map', horizon: 24 },
    { name: 'zone_sheet_replay', scenario: 'replay', tab: 'map', sheet: { type: 'zone', zone: 4 } },
    { name: 'strip_live', tab: 'strip' },
    { name: 'strip_daybefore', scenario: 'daybefore', tab: 'strip' },
    { name: 'advisor_form', tab: 'advisor' },
    { name: 'advice_send_live', tab: 'advisor', run: true },
    { name: 'advice_rail_replay', scenario: 'replay', tab: 'advisor', run: true },
    { name: 'advice_divert_replay', scenario: 'replay', tab: 'advisor', run: true, lot: { variety: 'Ambri', days: 4, tonnes: 9, dest: 'azadpur', type: 'multi', truck: 'JK13 D 0921' } },
    { name: 'advice_send_valley_daybefore', scenario: 'daybefore', tab: 'advisor', run: true, lot: { variety: 'Delicious', days: 3, tonnes: 10, dest: 'parimpora', type: 'multi', truck: 'JK03 F 2214' } },
    { name: 'board_agent', role: 'agent', scenario: 'replay' },
    { name: 'board_empty', role: 'agent', edge: 'empty' },
    { name: 'report_step1_offline', role: 'driver', network: 'offline' },
    { name: 'report_step2_gps_denied', role: 'driver', edge: 'error', report: { step: 2, hazard: 'rockfall' } },
    { name: 'report_step3', role: 'driver', report: { step: 3, hazard: 'landslide' } },
    { name: 'offline_queue_drawer', role: 'driver', network: 'offline', drawer: true, queue: [{ hazard: 'rockfall', zone: 4, place: 'Digdol' }] },
    { name: 'stale_banner', network: 'stale', tab: 'map' },
    { name: 'tcu_console', role: 'police', scenario: 'replay' },
    { name: 'tcu_after_publish', role: 'police', tab: 'map', scenario: 'live', override: { 4: { status: 'closed', hazard: 'landslide' } } },
    { name: 'loading', edge: 'loading', tab: 'map' },
    { name: 'error_offline_copy', edge: 'error', tab: 'map' },
  ];
  function selfTest() {
    const fail = [];
    const click = sel => { const el = typeof sel === 'string' ? phone.querySelector(sel) : sel; if (!el) { fail.push(`cannot find ${sel}`); return false; } el.click(); return true; };
    const expect = (c, m) => { if (!c) fail.push(m); };
    try {
      // Flow A, live run: advisor -> SEND -> commit -> board
      applyState({ name: 'reset' });
      click('[data-nav=advisor]');
      expect(!!$('#lotform', phone), 'advisor form did not open');
      click('#getadvice');
      expect($('.decision', phone)?.dataset.advice === 'SEND', 'live run should give SEND for the default lot');
      click('#commit');
      expect(S.tab === 'board', 'commit did not open the board');
      expect(!!$('.ship.new', phone), 'committed truck is not highlighted on the board');
      const ranks = boardList().map(t => t.d.priority);
      expect(ranks.every((v, i) => i === 0 || ranks[i - 1] >= v), 'board is not sorted by priority');
      // Flow A, replay: same lot -> RAIL (zones 3-5 high at +24 and +48, 57% shelf life used)
      applyState({ name: 'test', scenario: 'replay' });
      click('[data-nav=advisor]'); click('#getadvice');
      expect($('.decision', phone)?.dataset.advice === 'RAIL', 'replay should give RAIL for the default lot');
      // Flow B: offline driver report in 3 taps, queued, then sent when online
      applyState({ name: 'test', role: 'driver', network: 'offline' });
      click('[data-haz=rockfall]'); click('#rp-place'); click('#rp-send');
      expect(S.queue.length === 1, 'offline report was not queued');
      expect(/waiting/.test($('#banner').textContent), 'banner does not count the queued report');
      const net = $('#sim-network'); net.value = 'online'; net.dispatchEvent(new Event('change'));
      expect(S.queue.length === 0 && S.sent.length === 1, 'queued report was not sent when back online');
      // Flow C: police publishes a closure -> zone 4 confidence high, pushed
      applyState({ name: 'test', role: 'police' });
      const zs = $('#tcuform select[name=zone]', phone); zs.value = '4';
      click('#tcu-publish');
      expect(get(4, 0).confidence === 'high' && get(4, 0).level === 'high', 'TCU closure did not set zone 4 to high / high confidence');
      // edge states render
      ['loading', 'empty', 'error'].forEach(ed => { applyState({ name: 'test', edge: ed }); expect($('#screen').textContent.trim().length > 0, `edge state ${ed} is blank`); });
      // offline drawer shows a cache under 5 KB
      applyState({ name: 'test', network: 'offline' });
      expect(cacheBytes() < 5120, `cached summary is ${cacheBytes()} bytes, over 5 KB`);
      click('#banner');
      expect(phone.classList.contains('open') && /KB/.test($('#sheet').textContent), 'offline drawer did not open from the banner');
    } catch (err) { fail.push('exception: ' + err.message); }
    applyState({ name: 'reset' });
    return fail;
  }
  window.RG = { applyState, auditStates: () => AUDIT, selfTest, decide: lot => decide(lot), state: () => S };
  render();
