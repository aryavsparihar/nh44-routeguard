/* Clickable prototype.
   Risk rows are real job output (see the data note). People, trucks, phones and road reports are sample data.
   decide() is a stand-in for lib/decide.ts: it follows the Round 1 rules, but the shelf-life and price
   values are placeholders until the team's advice table lands.
   Every word on the phone goes through tr() (shared.js), so a translation table can be added when the app goes multilingual. */
  /* ---------------------------------------------------------------- prototype data */
  const SCEN = {
    live: { rows: D.live.rows, label: D.live.label, month: 11, when: '10 Nov 18:34 UTC', banner: ['Live · scores from the {when} run', { when: '10 Nov 18:34 UTC' }] },
    replay: { rows: D.replay.rows, label: D.replay.label, month: 8, when: '25 Aug 2025 06:00 UTC', banner: ['Replay · {when} run', { when: '25 Aug 2025 06:00 UTC' }] },
    daybefore: { rows: D.replay.day_before, label: 'Replay, 24 Aug 2025 06:00 UTC (a day before the closure)', month: 8, when: '24 Aug 2025 06:00 UTC', banner: ['Replay · {when} run', { when: '24 Aug 2025 06:00 UTC' }] },
  };
  const SHELF = { 'Delicious': 21, 'Kullu Delicious': 18, 'Maharaji': 28, 'Ambri': 35 }; // placeholder days
  const PRICE = { 'Delicious': 60, 'Kullu Delicious': 55, 'Maharaji': 45, 'Ambri': 80 }; // placeholder Rs/kg
  const DEST = {
    azadpur: { name: 'Azadpur (Delhi)', zones: [1, 2, 3, 4, 5, 6], valley: false, hours: 22 },
    narwal: { name: 'Narwal (Jammu)', zones: [1, 2, 3, 4, 5, 6], valley: false, hours: 9 },
    parimpora: { name: 'Parimpora (Srinagar)', zones: [6], valley: true, hours: 2 },
  };
  const TRUCK = { multi: 'Multi-axle (10+ wheels)', light: 'Light 6-wheeler' };
  const SAMPLE_TRUCKS = [
    { truck: 'JK03 F 2214', variety: 'Delicious', days: 12, tonnes: 10, dest: 'azadpur', type: 'multi', phone: '98•• ••• 214', seen: ['Budgam', 14] },
    { truck: 'JK22 C 8810', variety: 'Kullu Delicious', days: 15, tonnes: 8, dest: 'azadpur', type: 'multi', phone: '70•• ••• 810', seen: ['Sopore', 40] },
    { truck: 'JK01 AB 3301', variety: 'Maharaji', days: 5, tonnes: 6, dest: 'narwal', type: 'light', phone: '94•• ••• 301', seen: ['Shopian', 8] },
    { truck: 'JK13 D 0921', variety: 'Ambri', days: 20, tonnes: 9, dest: 'parimpora', type: 'light', phone: '60•• ••• 921', seen: ['Pulwama', 25] },
  ];
  const SAMPLE_REPORTS = {
    live: [{ src: 'unconfirmed', hazard: 'rockfall', zone: 4, place: 'Marog', mins: 25 }],
    replay: [{ src: 'police', hazard: 'landslide', zone: 4, place: 'Digdol', mins: 40, note: 'closed both ways' },
      { src: 'verified', hazard: 'landslide', zone: 3, place: 'Seri', mins: 70 },
      { src: 'unconfirmed', hazard: 'flash_flood', zone: 3, place: 'Nashri', mins: 15 }],
    daybefore: [{ src: 'unconfirmed', hazard: 'rockfall', zone: 4, place: 'Digdol', mins: 30 }],
  };
  const GPS = { lat: 33.30284, lng: 75.17981, zone: 4, place: 'Digdol' }; // points.json z4_digdol
  const ROLE = { grower: 'Grower / Trader', agent: 'Transport Agent', driver: 'Truck Driver', police: 'Traffic Police (TCU)' };
  const ROLE_TAB = { grower: 'map', agent: 'board', driver: 'report', police: 'report' };
  const PEOPLE = { // the four personas (05_Personas); sample numbers
    grower: { name: 'Haji Ghulam Nabi', phone: '9419011180' },
    agent: { name: 'Tariq Ahmad', phone: '7006122290' },
    driver: { name: 'Gurpreet Singh', phone: '9876504521', verified: true },
    police: { name: 'Insp. Rajesh Sharma', phone: '9419100007' },
  };
  const CODE = '418207'; // the SMS code in this prototype
  const STATUS = { closed: 'closed both ways', oneway: 'one-way only', open: 'open' };

  const DEFAULT = () => ({
    scenario: 'replay', network: 'online', edge: 'normal', role: 'grower', device: 'mobile',
    auth: null, tab: 'map', back: 'map', horizon: 0, zone: 4, sheet: null, drawer: false, dialog: null, sms: false,
    lot: { variety: 'Delicious', days: 12, tonnes: 10, dest: 'azadpur', type: 'multi', truck: 'JK05 G 7712' },
    advice: null, committed: [], newId: null, boardFilter: 'all',
    report: { step: 1, hazard: null, zone: null }, queue: [], sent: [], overrides: {}, pendingDone: {},
    tcu: { zone: 4, status: 'closed', hazard: 'landslide' },
    me: null, alertZones: [3, 4, 5], seen: {}, fresh: [],
    signin: freshSignin('9876543210'),
  });
  function freshSignin(phone) {
    return { phone: phone || '', code: '', err: null, sentAt: 0, busy: false, name: 'Gurpreet Singh', role: 'driver',
      truck: 'JK05 G 7712', agent: '70061 22290', firm: '', village: '', loc: true, alerts: true, errs: {}, failed: false };
  }
  let S = DEFAULT();
  let FAST = false; // the self-test skips the short "Sending…" waits

  const me = () => S.me || { ...PEOPLE[S.role], role: S.role };
  const initials = n => n.replace(/^(Haji|Insp\.)\s+/, '').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const digits = s => String(s).replace(/\D/g, '');
  const fmtPhone = p => { const d = digits(p).slice(0, 10); return d.length > 5 ? d.slice(0, 5) + ' ' + d.slice(5) : d; };
  const maskPhone = p => { const d = digits(p); return d.slice(0, 5) + ' x' + d.slice(6); };
  const hz = k => tr(HAZ[k]).toLowerCase();
  const later = (fn, ms) => (FAST ? fn() : setTimeout(fn, ms));

  function rows() {
    return SCEN[S.scenario].rows.map(r => {
      const o = S.overrides[r.zone_id];
      if (!o) return r;
      const x = { ...r, confidence: 'high', local: true };
      if (o.status === 'closed' && r.horizon_hours <= 12) {
        // an official closure is a fact, not a forecast: score 1.00, no range
        x.level = 'high'; x.top_hazard = o.hazard; x.overall = 1; x.risk_low = 1; x.risk_high = 1;
        x[o.hazard] = 1;
        x.reason = tr('TCU official: zone {z} closed ({haz}). Score set to 1.00 and confidence to High by police.', { z: r.zone_id, haz: hz(o.hazard) });
      } else if (r.horizon_hours === 0) {
        x.reason = tr('TCU official: zone {z} {status}. Confidence set to High by police.', { z: r.zone_id, status: tr(STATUS[o.status]) });
      } else x.local = false;
      return x;
    });
  }
  const get = (z, h) => rows().find(r => r.zone_id === z && r.horizon_hours === h);
  const zoneName = z => tr('Zone {z} ({name})', { z, name: tr(ZONE[z].name) });

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
    const v = { zone: zoneName(w.z), at: tr(AT[w.h]) };
    let advice, why, delay;
    if (w.level === 'low') {
      advice = 'SEND'; delay = 'none expected';
      why = d.zones.length === 1 ? tr('Zone {z} on your route stays low for 24 h. Leave in the next 12 h.', { z: d.zones[0] })
        : tr('All {n} zones on your route stay low for 24 h. Leave in the next 12 h.', { n: d.zones.length });
    } else if (w.level === 'medium') {
      if (lot.type === 'light' && !d.valley && month >= 5 && month <= 11) {
        advice = 'DIVERT'; delay = '+4 h (longer road)';
        why = tr('{zone} is medium {at}. A light truck can take Mughal Road (Shopian to Bufliaz) instead of NH-44.', v);
      } else {
        advice = 'HOLD'; delay = '+6 h';
        why = tr('{zone} is medium {at}. Wait 6 h and check again before loading.', v);
      }
    } else if (shut48 && !d.valley && spoil >= 0.5) {
      advice = 'RAIL'; delay = '+24 h by road, rail avoids it';
      why = tr(highZones.length > 1 ? 'Zones {zs} stay high at +24 h and +48 h, and this fruit has used {pct}% of its shelf life. Book a Budgam–Delhi parcel train slot.'
        : 'Zone {zs} stays high at +24 h and +48 h, and this fruit has used {pct}% of its shelf life. Book a Budgam–Delhi parcel train slot.', { zs: highZones.join(', '), pct: Math.round(spoil * 100) });
    } else {
      advice = 'DIVERT'; delay = '+24 h by road';
      why = d.valley ? tr('{zone} is high {at}. Keep the lot at a CA store near Pulwama until it clears.', v)
        : tr('{zone} is high {at}. The fruit can wait: send it to a CA store in the valley or sell at Parimpora.', v);
    }
    return { advice, why, delay, priority, spoil, value, worst: w, conf: w.confidence, shut48 };
  }
  function eta(t) {
    const a = t.d, h = DEST[t.dest].hours;
    if (a.advice === 'RAIL') return tr('by parcel train from Budgam');
    if (a.advice === 'SEND') return tr('about {h} h', { h });
    if (a.advice === 'HOLD') return tr('about {h} h, after the 6 h hold', { h: h + 6 });
    return a.delay.startsWith('+4') ? tr('about {h} h by Mughal Road', { h: h + 4 }) : tr('waits at a valley CA store');
  }
  const seenText = t => (t.seen ? tr('{place}, {m} min ago', { place: tr(t.seen[0]), m: t.seen[1] }) : tr('At the orchard, not left yet'));

  function boardList() {
    const all = [...SAMPLE_TRUCKS.map((t, i) => ({ ...t, id: 's' + i, sample: true })), ...S.committed];
    return all.map(t => ({ ...t, d: decide(t) })).sort((a, b) => b.d.priority - a.d.priority);
  }
  function reports() {
    const base = SAMPLE_REPORTS[S.scenario].map((r, i) => ({ ...r, id: 'r' + i, sample: true }));
    const tcu = Object.entries(S.overrides).map(([z, o]) => ({ id: 'tcu' + z, src: 'police', hazard: o.hazard, zone: +z, place: ZONE[z].short, mins: 0, note: STATUS[o.status] }));
    const sent = S.sent.map(r => ({ ...r, src: S.pendingDone[r.id] === 'ok' ? 'verified' : 'unconfirmed' }));
    return [...tcu, ...sent.filter(r => S.pendingDone[r.id] !== 'no'), ...base.map(r => S.pendingDone[r.id] === 'ok' ? { ...r, src: 'verified' } : r).filter(r => S.pendingDone[r.id] !== 'no')];
  }
  const reportText = r => `${hz(r.hazard)} · ${tr(r.place)}${r.note ? ', ' + tr(r.note) : ''} · ${r.mins ? tr('{m} min ago', { m: r.mins }) : tr('just now')}`;
  function cacheBytes() {
    const slim = rows().map(r => [r.zone_id, r.horizon_hours, r.level[0], +r.overall.toFixed(2), r.confidence[0], r.top_hazard]);
    return new TextEncoder().encode(JSON.stringify({ run: SCEN[S.scenario].when, rows: slim })).length;
  }

  /* alerts for the signed-in user: police updates, verified reports and high forecasts in their alert zones */
  function alerts() {
    const out = [], zs = S.alertZones;
    reports().filter(r => r.src === 'police').forEach(r => out.push({ id: 'p' + r.id + r.note, tone: 'police', zone: r.zone, h: 0,
      head: tr('Police: zone {z} {what}', { z: r.zone, what: tr(r.note || 'update') }), sub: `${tr(HAZ[r.hazard])} · ${tr(r.place)} · ${r.mins ? tr('{m} min ago', { m: r.mins }) : tr('just now')}` }));
    reports().filter(r => r.src === 'verified' && zs.includes(r.zone)).forEach(r => out.push({ id: 'v' + r.id, tone: 'verified', zone: r.zone, h: 0,
      head: tr('{haz} confirmed at {place}', { haz: tr(HAZ[r.hazard]), place: tr(r.place) }), sub: tr('Verified driver report, zone {z} · {m} min ago', { z: r.zone, m: r.mins || 1 }) }));
    zs.forEach(z => { const h = [0, 12, 24, 48].find(x => get(z, x).level === 'high');
      if (h !== undefined && !reports().some(r => r.src === 'police' && r.zone === z)) out.push({ id: 'f' + S.scenario + z + h, tone: 'high', zone: z, h,
        head: h === 0 ? tr('Zone {z} is high risk now', { z }) : tr('Zone {z} turns high risk {at}', { z, at: tr(AT[h]) }), sub: tr(ZONE[z].name) + ' · ' + tr('{conf} confidence', { conf: tr(get(z, h).confidence) }) }); });
    if (S.network === 'stale') out.push({ id: 'stale', tone: 'stale', head: tr('Scores are 3 h old'), sub: tr('The hourly run was missed; showing the last good scores.') });
    if (S.queue.length) out.push({ id: 'q' + S.queue.length, tone: 'queued', head: tr(S.queue.length > 1 ? '{n} reports waiting to send' : '{n} report waiting to send', { n: S.queue.length }), sub: tr('They send by themselves when you have signal.') });
    return out;
  }
  const unread = () => alerts().filter(a => !S.seen[a.id]).length;
  function openAlerts() { const list = alerts(); S.fresh = list.filter(a => !S.seen[a.id]).map(a => a.id); list.forEach(a => { S.seen[a.id] = true; }); }

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
      return `<text x="${(p.xy[0] + (left ? -14 : 22)).toFixed(1)}" y="${(p.xy[1] + 4).toFixed(1)}" text-anchor="${left ? 'end' : 'start'}" font-size="12" font-weight="600" fill="${C['text.primary']}">${esc(tr(t))}</text>`; }).join('');
    const pins = reports().map((r, i) => { const p = MAP.pts.filter(q => q.zone_id === r.zone)[i % MAP.pts.filter(q => q.zone_id === r.zone).length]; const c = r.src === 'police' ? C['rail.fill'] : r.src === 'verified' ? C['send.fill'] : C['text.secondary'];
      return `<g pointer-events="none" transform="translate(${(p.xy[0] - 40).toFixed(1)},${(p.xy[1] - 10).toFixed(1)})"><rect width="20" height="20" rx="10" fill="#FFFFFF" stroke="${c}" stroke-width="2" ${r.src === 'unconfirmed' ? 'stroke-dasharray="3 2"' : ''}/><use href="#i-${HAZ_ICON[r.hazard]}" x="3" y="3" width="14" height="14" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></g>`; }).join('');
    const said = [1, 2, 3, 4, 5, 6].map(z => tr('Zone {z} {level}', { z, level: tr(lv[z]) })).join(', ');
    return `<svg viewBox="0 0 ${MAP.W} ${MAP.H}" ${big ? 'style="height:100%;width:auto;max-width:100%"' : ''} role="img" aria-label="${esc(tr('NH-44 risk map at {when}.', { when: tr(HL[h]) }) + ' ' + said)}.">
      <defs><pattern id="pat-medium" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="6" fill="rgba(255,255,255,.45)"/></pattern>
      <pattern id="pat-high" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M0 0 5 5M5 0 0 5" stroke="rgba(255,255,255,.5)" stroke-width="1.2"/></pattern></defs>
      ${hexes}${route}${labels}${pins}</svg>`;
  }

  /* ---------------------------------------------------------------- small parts */
  const TITLES = { map: 'Risk map', strip: '48-hour strip', advisor: 'Dispatch advisor', board: 'Shipment board', report: 'Report a hazard', alerts: 'Alerts', profile: 'Profile and settings' };
  const T = (s, v) => esc(tr(s, v)); // translated and escaped, for HTML
  const hl = h => (h === 0 ? tr('Now') : tr(HL[h]));
  const spinner = () => '<span class="spin" aria-hidden="true"></span>';
  const ferr = (msg, id) => `<div class="ferr"${id ? ` id="${id}"` : ''} role="alert">${icon('nav-report', 'ico sm')}<span>${esc(msg)}</span></div>`;
  const milestone = () => '<span class="ms" aria-hidden="true"><b>NH</b><i>44</i></span>';
  const horizonChips = () => `<div class="scroll-x" role="group" aria-label="${T('Forecast time')}">${[0, 12, 24, 48].map(h => `<button class="chip" data-h="${h}" aria-pressed="${S.horizon === h}">${esc(hl(h))}</button>`).join('')}</div>`;
  const legend = () => `<div class="legend" aria-hidden="true"><span><i style="background:${C['risk.low.map']}"></i>${T('Low')}</span><span><i style="background:${C['risk.medium.map']};background-image:repeating-linear-gradient(45deg,transparent 0 3px,rgba(255,255,255,.5) 3px 5px)"></i>${T('Medium')}</span><span><i style="background:${C['risk.high.map']};background-image:repeating-linear-gradient(45deg,transparent 0 2px,rgba(255,255,255,.5) 2px 3px),repeating-linear-gradient(-45deg,transparent 0 2px,rgba(255,255,255,.5) 2px 3px)"></i>${T('High')}</span></div>`;
  const zoneButtons = h => `<div class="zone-btns">${[1, 2, 3, 4, 5, 6].map(z => { const r = get(z, h); return `<button class="zbtn lv-${r.level}" data-zone="${z}" aria-label="${T('Zone {z} {name}: {level} risk {score}', { z, name: tr(ZONE[z].name), level: tr(r.level), score: r.overall.toFixed(2) })}">Z${z} ${T(ZONE[z].short)}<span class="num">${esc(tr(r.level).toUpperCase())} ${r.overall.toFixed(2)}</span></button>`; }).join('')}</div>`;
  const reportList = () => { const rs = reports(); return rs.length ? `<div class="label">${T('Road reports (sample)')}</div><div class="stack">${rs.map(r => `<div>${reportPill(r.src, reportText(r))}</div>`).join('')}</div>` : ''; };
  const sw = (k, title, sub) => `<button type="button" class="sw" role="switch" aria-checked="${!!S.signin[k]}" data-sw="${k}"><span class="sw-t"><strong>${T(title)}</strong><span class="muted">${T(sub)}</span></span><span class="knob" aria-hidden="true"></span></button>`;

  /* ---------------------------------------------------------------- sign-in screens (Flow D) */
  function scrWelcome() {
    const si = S.signin;
    const msg = { phone: 'Enter all 10 digits of your mobile number.', nosignal: 'No signal right now. Sign-in needs one SMS. Your number is kept; try again when you have signal.',
      server: 'We could not send the code just now. Your number is kept; try again in a minute.' }[si.err];
    return `<div class="auth">
      <div class="brand">${milestone()}<span>RouteGuard</span></div>
      <p class="lead">${T('Know before you load: where NH-44 may close in the next 48 hours, and what to do with your lot.')}</p>
      <ul class="gets"><li>${icon('nav-strip')}<span>${T('Risk for each of the 6 zones, from now to 48 hours ahead')}</span></li><li>${icon('nav-advisor')}<span>${T('One answer for your lot: send, hold, rail or divert')}</span></li><li>${icon('status-offline-queue')}<span>${T('Works in the gorge with no signal')}</span></li></ul>
      <label class="field"><span>${T('Mobile number')}</span><span class="tel${si.err === 'phone' ? ' bad' : ''}"><span class="cc">+91</span><input id="au-phone" type="text" inputmode="numeric" autocomplete="tel-national" maxlength="11" value="${esc(fmtPhone(si.phone))}" aria-describedby="${msg ? 'au-err ' : ''}au-help"${si.err === 'phone' ? ' aria-invalid="true"' : ''}></span></label>
      ${msg ? ferr(tr(msg), 'au-err') : ''}
      <button class="btn primary wide" id="au-send" ${si.busy ? 'disabled' : ''}>${si.busy ? spinner() + T('Sending code…') : T('Send code')}</button>
      <p class="muted" id="au-help" style="margin:0">${T('No password. We send a 6-digit code to this number by SMS.')}</p></div>`;
  }
  const resendLeft = () => Math.max(0, 30 - Math.floor((Date.now() - S.signin.sentAt) / 1000));
  const resendHtml = () => { const l = resendLeft(); return l > 0 ? `<p class="muted" style="margin:0">${T('Send a new code in 0:{s}', { s: String(l).padStart(2, '0') })}</p>` : `<button class="btn wide" id="au-resend">${T('Send a new code')}</button>`; };
  function scrOtp() {
    const si = S.signin;
    const msg = { wrong: 'That code is wrong. Check the SMS and try again.', expired: 'That code has expired. Send a new code; your number is kept.', short: 'Type all 6 digits of the code.' }[si.err];
    return `<div class="auth">
      <button class="btn ghost back" id="au-back">← ${T('Change number')}</button>
      <h2 class="h">${T('Enter the 6-digit code')}</h2>
      <p class="muted" style="margin:0">${T('Sent by SMS to +91 {p}.', { p: maskPhone(si.phone) })}</p>
      <div class="otp${si.err ? ' bad' : ''}"><input id="au-code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" value="${esc(si.code)}" aria-label="${T('6-digit code')}"${si.err ? ' aria-invalid="true" aria-describedby="au-err"' : ''}>
        <div class="boxes" aria-hidden="true">${[0, 1, 2, 3, 4, 5].map(i => `<span class="${i === Math.min(si.code.length, 5) ? 'cur' : ''}">${esc(si.code[i] || '')}</span>`).join('')}</div></div>
      ${msg ? ferr(tr(msg), 'au-err') : ''}
      <button class="btn primary wide" id="au-verify" ${si.busy ? 'disabled' : ''}>${si.busy ? spinner() + T('Checking…') : T('Verify')}</button>
      <div id="au-resend-box">${resendHtml()}</div></div>`;
  }
  function scrCreate() {
    const si = S.signin, e = si.errs;
    const card = (k, t, sub) => `<label><input type="radio" name="role" value="${k}" ${si.role === k ? 'checked' : ''}><span><strong>${T(t)}</strong><br><span class="muted">${T(sub)}</span></span></label>`;
    const fld = (name, label, val, help) => `<label class="field"><span>${T(label)}</span><input type="text" name="${name}" value="${esc(val)}" autocomplete="off">${help ? `<span class="muted help">${T(help)}</span>` : ''}</label>`;
    const extra = si.role === 'driver' ? fld('truck', 'Truck number', si.truck) + fld('agent', "Your agent's phone", si.agent, 'Your agent confirms you. Until then your reports show as unconfirmed.')
      : si.role === 'agent' ? fld('firm', 'Firm name', si.firm || 'Ahmad Transport, Sopore') : si.role === 'grower' ? fld('village', 'Village or orchard area', si.village || 'Shopian') : '';
    return `<form class="auth form" id="au-create" novalidate>
      <h2 class="h">${T('Create your account')}</h2>
      <label class="field"><span>${T('Full name')}</span><input type="text" name="name" value="${esc(si.name)}" autocomplete="name"${e.name ? ' aria-invalid="true"' : ''}></label>${e.name ? ferr(tr('Enter your name as your agent knows it.')) : ''}
      <div class="field"><span>${T('I am a')}</span><div class="radio-cards" role="radiogroup" aria-label="${T('I am a')}">${card('grower', 'Grower / trader', 'I decide when to send my lots')}${card('agent', 'Transport agent', 'I run trucks and drivers')}${card('driver', 'Truck driver', 'I drive NH-44 and report hazards')}</div></div>${e.role ? ferr(tr('Choose one of the three.')) : ''}
      ${extra}
      <div class="field"><span>${T('You choose what we use')}</span>${sw('loc', 'Location, to tag your reports', 'Off: you pick your zone by hand.')}${sw('alerts', 'Alerts for zones on your route', 'Police closures and high-risk warnings.')}</div>
      <details class="why"><summary>${T('What we keep, and for how long')}</summary><p>${T('Your phone number, name and role, and the reports you send. Other users never see your number. Delete your account any time from Profile.')}</p></details>
      ${si.failed ? ferr(tr('We could not save your account. Nothing you typed is lost; try again.')) : ''}
      <button class="btn primary wide" type="submit" id="au-create-go" ${si.busy ? 'disabled' : ''}>${si.busy ? spinner() + T('Creating your account…') : T('Create account')}</button>
      <p class="muted" style="margin:0">${T('Police and TCU accounts are added by an admin.')}</p></form>`;
  }

  /* ---------------------------------------------------------------- app screens */
  function scrMap() {
    const h = S.horizon;
    return `${horizonChips()}<div class="mapbox">${mapSvg(h)}</div>${legend()}
      <p class="muted" style="margin:0">${T('Cells are drawn along the route for this prototype; the app uses H3 cells from our corridor file.')}</p>
      ${zoneButtons(h)}${reportList()}`;
  }
  function scrStrip() {
    let w = null; rows().forEach(r => { if (!w || LV[r.level] > LV[w.level] || (r.level === w.level && r.overall > w.overall)) w = r; });
    const head = w.level === 'low' ? tr('All 6 zones stay low for 48 h. Worst: zone {z} at {s} ({when}).', { z: w.zone_id, s: w.overall.toFixed(2), when: tr(HL[w.horizon_hours]) })
      : tr('Worst on the route: zone {z} ({place}) is {level} {at}.', { z: w.zone_id, place: tr(ZONE[w.zone_id].short), level: tr(w.level), at: tr(AT[w.horizon_hours]) });
    return `<div class="card sand" style="padding:12px"><strong>${esc(head)}</strong></div>
      <table class="strip"><thead><tr><th class="z" scope="col">${T('Zone')}</th>${[0, 12, 24, 48].map(h => `<th scope="col">${esc(hl(h))}</th>`).join('')}</tr></thead><tbody>
      ${[1, 2, 3, 4, 5, 6].map(z => `<tr><th class="z" scope="row">${z} ${T(ZONE[z].short)}</th>${[0, 12, 24, 48].map(h => { const r = get(z, h);
        return `<td><button class="cellbtn lv-${r.level}" data-zone="${z}" data-h="${h}" aria-label="${T('Zone {z} at {when}: {level} risk {score}', { z, when: tr(HL[h]), level: tr(r.level), score: r.overall.toFixed(2) })}"><span>${r.overall.toFixed(2)}</span><span class="lv">${T(r.level === 'medium' ? 'med' : r.level)}</span></button></td>`; }).join('')}</tr>`).join('')}
      </tbody></table><p class="muted" style="margin:0">${T('Medium cells have stripes and high cells cross-hatching, so the level reads without colour. Tap a cell to see why.')}</p>`;
  }
  function scrAdvisor() {
    const l = S.lot;
    if (S.advice) {
      const a = S.advice;
      return `${decisionBanner(a.advice, a.why)}
        <div class="label">${T('Zone that drives this')}</div>${zoneCard(a.worst.z, a.worst)}
        <div class="grid" style="grid-template-columns:1fr 1fr;gap:8px">
          <div class="card" style="padding:12px"><div class="label">${T('Expected delay')}</div><strong>${T(a.delay)}</strong></div>
          <div class="card" style="padding:12px"><div class="label">${T('Priority')}</div><strong class="num">${a.priority.toFixed(2)}</strong><div class="muted">${T('{pct}% shelf life × Rs {v} lakh', { pct: Math.round(a.spoil * 100), v: a.value.toFixed(1) })}</div></div></div>
        <p class="muted" style="margin:0">${T('{t} t {variety}, picked {d} days ago, to {dest}, {truck}.', { t: l.tonnes, variety: l.variety, d: l.days, dest: tr(DEST[l.dest].name), truck: tr(TRUCK[l.type]).toLowerCase() })} ${T('Shelf-life and price values are placeholders until our advice table lands.')}</p>
        <button class="btn primary wide" id="commit">${icon('nav-board')}${T('Commit {truck} to the board', { truck: l.truck })}</button>
        <button class="btn wide" id="change">${T('Change lot')}</button>`;
    }
    const radio = (name, opts, cur) => `<div class="radio-cards" role="radiogroup">${Object.entries(opts).map(([v, t]) => `<label><input type="radio" name="${name}" value="${v}" ${v === cur ? 'checked' : ''}><span>${T(t)}</span></label>`).join('')}</div>`;
    return `<form class="form" id="lotform" novalidate>
      <label class="field"><span>${T('Variety')}</span><select name="variety">${Object.keys(SHELF).map(v => `<option ${v === l.variety ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <div class="grid" style="grid-template-columns:1fr 1fr;gap:8px">
        <label class="field"><span>${T('Days since picking')}</span><input type="number" name="days" min="0" max="60" inputmode="numeric" value="${l.days}"></label>
        <label class="field"><span>${T('Tonnes')}</span><input type="number" name="tonnes" min="1" max="30" inputmode="decimal" value="${l.tonnes}"></label></div>
      <div class="field"><span>${T('Destination')}</span>${radio('dest', Object.fromEntries(Object.entries(DEST).map(([k, v]) => [k, v.name])), l.dest)}</div>
      <div class="field"><span>${T('Truck')}</span>${radio('type', TRUCK, l.type)}</div>
      <label class="field"><span>${T('Truck number')}</span><input type="text" name="truck" value="${esc(l.truck)}" autocomplete="off"></label>
      <button class="btn primary wide" type="submit" id="getadvice">${icon('nav-advisor')}${T('Get advice')}</button></form>`;
  }
  function shipCard(t, i) {
    const a = ADV[t.d.advice];
    return `<button class="ship${t.id === S.newId ? ' new' : ''}" data-ship="${esc(t.id)}" aria-label="${T('Truck {truck}, rank {r}: {advice}. Open details.', { truck: t.truck, r: i + 1, advice: tr(a.word) })}"><span class="top"><span class="rank">#${i + 1}</span><strong class="num">${esc(t.truck)}</strong><span class="badge" style="--c-bg:var(--${t.d.advice.toLowerCase()}-bg);--c-text:var(--${t.d.advice.toLowerCase()}-text)">${icon(a.icon, 'ico sm')}${T(a.word)}</span></span>
      <span class="kv"><span>${esc(t.tonnes + ' t ' + t.variety)}</span><span>${T('to {dest}', { dest: tr(DEST[t.dest].name) })}</span><span>${T('priority')} <span class="num">${t.d.priority.toFixed(2)}</span></span></span>
      <span class="kv"><span>${T('Last seen: {s}', { s: seenText(t) })}</span><span>${T('ETA: {e}', { e: eta(t) })}</span></span>
      ${t.sample ? '' : `<span class="pill ok" style="justify-self:start">${T('just committed')}</span>`}</button>`;
  }
  function scrBoard() {
    const list = boardList();
    const shown = list.filter(t => S.boardFilter === 'all' || (S.boardFilter === 'moving' ? ['SEND', 'RAIL', 'DIVERT'].includes(t.d.advice) : t.d.advice === 'HOLD'));
    const tabs = `<div class="tabrow" role="tablist" aria-label="${T('Filter trucks')}">${[['all', 'All'], ['moving', 'Moving'], ['held', 'Held']].map(([k, t]) => `<button role="tab" data-filter="${k}" aria-selected="${S.boardFilter === k}">${T(t)}</button>`).join('')}</div>`;
    const body = shown.length ? shown.map(t => shipCard(t, list.indexOf(t))).join('') : `<div class="empty">${icon('nav-board')}<strong>${T('No trucks in this filter')}</strong></div>`;
    return `${tabs}<p class="muted" style="margin:0">${T('Ranked by priority = spoilage × load value. Tap a truck for its detail. Sample trucks and masked phones.')}</p><div class="stack">${body}</div>`;
  }
  function scrReport() {
    if (S.role === 'police') return scrTcu();
    const rp = S.report;
    const steps = `<div class="steps" role="img" aria-label="${T('Step {n} of 3', { n: rp.step })}">${[1, 2, 3].map(i => `<span class="${i <= rp.step ? 'on' : ''}"></span>`).join('')}</div>`;
    if (rp.step === 1) {
      return `${steps}<h3 style="margin:0">${T('What did you see?')}</h3><div class="hazgrid">${Object.entries(HAZ).map(([k, t]) => `<button class="hazbtn" data-haz="${k}" aria-pressed="${rp.hazard === k}">${icon(HAZ_ICON[k])}<span>${T(t)}</span></button>`).join('')}</div>
        <div class="callout" style="margin:0">${T(S.network === 'offline' ? 'No signal right now. Your report will wait on this phone and send by itself.' : 'Reports reach the TCU control room and drivers behind you.')}</div>`;
    }
    if (rp.step === 2) {
      const gpsOff = S.edge === 'error';
      const where = gpsOff
        ? `<div class="callout warn" style="margin:0"><strong>${T('Location is off.')}</strong> ${T('Pick the zone you are in.')}</div><div class="scroll-x">${[1, 2, 3, 4, 5, 6].map(z => `<button class="chip" data-rzone="${z}" aria-pressed="${rp.zone === z}">Z${z} ${T(ZONE[z].short)}</button>`).join('')}</div>`
        : `<div class="card" style="padding:12px"><div class="label">${T('Your location (GPS)')}</div><div class="coords">${GPS.lat.toFixed(5)}, ${GPS.lng.toFixed(5)}</div><div>${T('Near {place}, zone {z} ({name})', { place: tr(GPS.place), z: GPS.zone, name: tr(ZONE[GPS.zone].name) })}</div></div>`;
      return `${steps}<h3 style="margin:0">${icon(HAZ_ICON[rp.hazard], 'ico sm')} ${T('{haz}: where?', { haz: tr(HAZ[rp.hazard]) })}</h3><div class="photo">${T('Add a photo (optional)')}</div>${where}
        <button class="btn report wide" id="rp-place" ${gpsOff && !rp.zone ? 'disabled' : ''}>${T('This is the place')}</button><button class="btn wide" id="rp-back">${T('Back')}</button>`;
    }
    const z = rp.zone || GPS.zone;
    return `${steps}<h3 style="margin:0">${T('Send this report?')}</h3><div class="card" style="padding:12px;display:grid;gap:6px">${reportPill('unconfirmed', hz(rp.hazard))}<div>${T('Zone {z}, {place}', { z, place: tr(rp.zone ? ZONE[z].short : GPS.place) })}</div><div class="muted">${T('It shows as unconfirmed until police or a second driver confirms it.')}</div></div>
      <button class="btn report wide" id="rp-send">${icon('nav-report')}${T(S.network === 'offline' ? 'Save and send when online' : 'Send report')}</button><button class="btn wide" id="rp-back">${T('Back')}</button>`;
  }
  function tcuForm(compact) {
    const t = S.tcu;
    return `<form class="form" id="tcuform">
        <label class="field"><span>${T('Zone')}</span><select name="zone">${[1, 2, 3, 4, 5, 6].map(z => `<option value="${z}" ${z === t.zone ? 'selected' : ''}>${T('Zone {z} · {name}', { z, name: tr(ZONE[z].name) })}</option>`).join('')}</select></label>
        <div class="field"><span>${T('Road status')}</span><div class="radio-cards${compact ? ' row3' : ''}" role="radiogroup">${[['closed', 'Closed both ways'], ['oneway', 'One-way only'], ['open', 'Open']].map(([v, l]) => `<label><input type="radio" name="status" value="${v}" ${v === t.status ? 'checked' : ''}><span>${T(l)}</span></label>`).join('')}</div></div>
        <label class="field"><span>${T('Cause')}</span><select name="hazard">${Object.entries(HAZ).map(([k, v]) => `<option value="${k}" ${k === t.hazard ? 'selected' : ''}>${T(v)}</option>`).join('')}</select></label>
        <button class="btn rail wide" type="submit" id="tcu-publish">${T('Publish and alert drivers in the zone')}</button></form>`;
  }
  function pendingList() {
    const pend = reports().filter(r => r.src === 'unconfirmed');
    return `<div class="label">${T('Driver reports waiting ({n})', { n: pend.length })}</div>
      <div class="stack">${pend.length ? pend.map(r => `<div class="ship"><div>${reportPill('unconfirmed', reportText(r))}</div><div class="grid" style="grid-template-columns:1fr 1fr;gap:8px"><button class="btn" data-confirm="${r.id}">${T('Confirm')}</button><button class="btn" data-reject="${r.id}">${T('Reject')}</button></div></div>`).join('') : `<p class="muted">${T('No reports waiting.')}</p>`}</div>`;
  }
  function scrTcu() { return `<div class="label">${T('TCU official advisory')}</div>${tcuForm()}${pendingList()}`; }
  function scrAlerts() {
    const list = alerts();
    if (!S.alertZones.length) return `<div class="empty">${icon('nav-alerts')}<strong>${T('Alerts are off')}</strong><p class="muted" style="margin:0">${T('Pick the zones on your route in Profile to get police closures and high-risk warnings.')}</p><button class="btn primary" data-go="profile">${T('Choose alert zones')}</button></div>`;
    if (!list.length) return `<div class="empty">${icon('nav-alerts')}<strong>${T('No alerts for zones {zs}', { zs: S.alertZones.join(', ') })}</strong><p class="muted" style="margin:0">${T('We alert you when police close a zone or a zone on your route turns high risk.')}</p><button class="btn" data-go="profile">${T('Change alert zones')}</button></div>`;
    return `<p class="muted" style="margin:0">${T('For zones {zs}. Tap an alert to see the zone.', { zs: S.alertZones.join(', ') })}</p><div class="stack">${list.map(a => `<button class="alert a-${a.tone}" ${a.zone ? `data-zone="${a.zone}" data-h="${a.h}"` : 'data-open="drawer"'}>${S.fresh.includes(a.id) ? `<span class="tag">${T('New')}</span>` : ''}<strong>${esc(a.head)}</strong><span>${esc(a.sub)}</span></button>`).join('')}</div>`;
  }
  function scrProfile() {
    const u = me();
    const badge = u.role === 'driver' ? (u.verified ? `<span class="badge" style="--c-bg:var(--send-bg);--c-text:var(--send-text)">${T('Verified by your agent')}</span>` : `<span class="badge" style="--c-bg:var(--hold-bg);--c-text:var(--hold-text)">${T('Waiting for your agent')}</span>`)
      : u.role === 'police' ? `<span class="badge" style="--c-bg:var(--rail-bg);--c-text:var(--rail-text)">${T('Added by admin')}</span>` : '';
    return `<div class="who"><span class="av" aria-hidden="true">${esc(initials(u.name))}</span><div><strong class="nm">${esc(u.name)}</strong><div class="muted">+91 ${esc(maskPhone(u.phone))}</div><div class="tags"><span class="badge" style="--c-bg:var(--bg-surface);--c-text:var(--text-primary)">${T(ROLE[u.role])}</span>${badge}</div></div></div>
      <div class="field"><span>${T('Alert zones')}</span><div class="chips-wrap" role="group" aria-label="${T('Alert zones')}">${[1, 2, 3, 4, 5, 6].map(z => `<button class="chip" data-az="${z}" aria-pressed="${S.alertZones.includes(z)}">Z${z} ${T(ZONE[z].short)}</button>`).join('')}</div></div>
      <div class="card" style="padding:12px;display:grid;gap:2px"><div class="label">${T('Offline data')}</div><div>${T('{kb} KB on this phone · scores from the {when} run', { kb: (cacheBytes() / 1024).toFixed(1), when: SCEN[S.scenario].when })}</div></div>
      <button class="btn wide" id="pf-signout">${T('Sign out')}</button>
      <button class="btn wide danger" id="pf-delete">${T('Delete my account')}</button>
      <p class="muted" style="margin:0">${T('Unsent reports stay on this phone and still send after you sign out.')}</p>`;
  }

  function skeleton() { return `<div class="skel" style="height:48px"></div><div class="skel" style="height:300px"></div><div class="skel" style="height:56px"></div><div class="skel" style="height:56px"></div><p class="muted" role="status" style="margin:0">${T('Loading the latest scores…')}</p>`; }
  function emptyState() {
    const E = {
      map: ['nav-map', 'No scores for this hour yet', 'The hourly job runs at 7 minutes past the hour. The last scores will show here.', 'Check again', 'retry'],
      strip: ['nav-strip', 'No forecast to show', 'The 48-hour strip fills after the next run.', 'Check again', 'retry'],
      advisor: ['nav-advisor', 'No lots yet', 'Add your first lot to get advice.', 'Add a lot', 'normal'],
      board: ['nav-board', 'No trucks on the board', 'Commit a lot from the advisor and it shows here, ranked.', 'Plan a lot', 'advisor'],
      report: ['nav-report', 'No reports from your zone', 'Seen debris or water on the road? Report it in 3 taps.', 'Report a hazard', 'normal'],
    }[S.tab];
    if (!E) return null;
    return `<div class="empty">${icon(E[0])}<strong>${T(E[1])}</strong><p class="muted" style="margin:0">${T(E[2])}</p><button class="btn primary" data-empty="${E[4]}">${T(E[3])}</button></div>`;
  }
  function errorState() {
    if ((S.tab === 'report' && S.role !== 'police') || S.tab === 'profile') return null; // report shows the GPS-denied fallback instead
    return `<div class="empty">${icon('hazard-rockfall')}<strong>${T("Can't reach RouteGuard")}</strong><p class="muted" style="margin:0">${T('Showing nothing rather than old scores as new. Check your signal and try again, or open the offline copy.')}</p>
      <button class="btn primary" data-empty="retry">${T('Try again')}</button><button class="btn" data-open="drawer">${T('Open offline copy')}</button></div>`;
  }

  function bannerState() {
    if (S.edge === 'error' && errorState()) return ['error', tr("Can't reach the server · tap to retry")];
    const q = S.queue.length;
    if (S.network === 'offline') return q ? ['queued', tr(q > 1 ? 'Offline · {n} reports waiting to send' : 'Offline · {n} report waiting to send', { n: q })] : ['offline', tr('Offline · cached scores from 2 h ago, {kb} KB', { kb: (cacheBytes() / 1024).toFixed(1) })];
    if (S.network === 'stale') return ['stale', tr('Scores are 3 h old · the hourly job missed a run')];
    return ['live', tr(...SCEN[S.scenario].banner)];
  }

  /* ---------------------------------------------------------------- sheets and dialogs */
  function sheetZone() {
    const z = S.sheet.zone, h = S.sheet.h ?? S.horizon, r = get(z, h);
    const bars = Object.entries(HAZ).map(([k, t]) => `<div class="b"><span>${T(t)}</span><div class="track"><div class="fill" style="width:${Math.round(r[k] * 100)}%"></div></div><span class="num">${r[k].toFixed(2)}</span></div>`).join('');
    const inc = D.incidents.filter(i => +i.zone_id === z);
    return `<div class="grab"></div><div class="sh-head"><h3 id="sheet-title" style="margin:0">${T('Zone {z} · {when}', { z, when: tr(HL[h]) })}</h3><button class="btn ghost" data-close aria-label="${T('Close')}">✕</button></div>
      ${zoneCard(z, r)}
      <div class="label">${T('Hazard scores')}</div><div class="bars">${bars}</div>
      <div class="label">${T('Outlook')}</div><div class="scroll-x">${[0, 12, 24, 48].map(hh => `<button class="chip" data-sh="${hh}" aria-pressed="${hh === h}">${esc(hl(hh))} ${get(z, hh).level === 'high' ? '▲▲' : get(z, hh).level === 'medium' ? '▲' : '·'}</button>`).join('')}</div>
      <div class="label">${T('Past closures here (incidents.csv)')}</div>
      ${inc.length ? `<ul style="margin:0;padding-left:20px">${inc.map(i => `<li>${T('{date}: {place}, {haz}, closed {h} h, {n} trucks', { date: i.date, place: tr(i.place), haz: HAZ[i.hazard_type] ? hz(i.hazard_type) : i.hazard_type, h: i.hours_closed, n: i.trucks_stranded })}</li>`).join('')}</ul>` : `<p class="muted" style="margin:0">${T('None logged yet.')}</p>`}
      <button class="btn primary wide" data-plan>${T('Plan a lot through this zone')}</button>`;
  }
  function sheetShip() {
    const list = boardList(), i = list.findIndex(x => x.id === S.sheet.id), t = list[i];
    if (!t) return '';
    const kv = (k, v) => `<dt>${T(k)}</dt><dd>${esc(v)}</dd>`;
    const zs = DEST[t.dest].zones;
    return `<div class="grab"></div><div class="sh-head"><h3 id="sheet-title" style="margin:0"><span class="num" style="font-size:18px">${esc(t.truck)}</span> · #${i + 1}</h3><button class="btn ghost" data-close aria-label="${T('Close')}">✕</button></div>
      ${decisionBanner(t.d.advice, t.d.why)}
      <dl class="kvs">${kv('Lot', `${t.tonnes} t ${t.variety}, ${tr('picked {d} days ago', { d: t.days })}`)}${kv('Going to', tr(DEST[t.dest].name))}${kv('Last seen', seenText(t))}${kv('ETA', eta(t))}${kv('Expected delay', tr(t.d.delay))}${kv('Priority', `${t.d.priority.toFixed(2)} (${tr('{pct}% shelf life × Rs {v} lakh', { pct: Math.round(t.d.spoil * 100), v: t.d.value.toFixed(1) })})`)}${kv('Driver', t.phone)}</dl>
      <div class="label">${T('Zones on this route')}</div>
      <table class="strip"><thead><tr><th class="z" scope="col">${T('Zone')}</th>${[0, 24, 48].map(h => `<th scope="col">${esc(hl(h))}</th>`).join('')}</tr></thead><tbody>${zs.map(z => `<tr><th class="z" scope="row">${z} ${T(ZONE[z].short)}</th>${[0, 24, 48].map(h => { const r = get(z, h); return `<td><button class="cellbtn lv-${r.level}" data-zone="${z}" data-h="${h}" aria-label="${T('Zone {z} at {when}: {level} risk {score}', { z, when: tr(HL[h]), level: tr(r.level), score: r.overall.toFixed(2) })}"><span>${r.overall.toFixed(2)}</span><span class="lv">${T(r.level === 'medium' ? 'med' : r.level)}</span></button></td>`; }).join('')}</tr>`).join('')}</tbody></table>
      <button class="btn primary wide" data-call="${esc(t.phone)}">${T('Call the driver')}</button>`;
  }
  function sheetDrawer() {
    const kb = (cacheBytes() / 1024).toFixed(1);
    const q = S.queue;
    return `<div class="grab"></div><div class="sh-head"><h3 id="sheet-title" style="margin:0">${T('Offline and sync')}</h3><button class="btn ghost" data-close aria-label="${T('Close')}">✕</button></div>
      <div class="sync ${SYNC[bannerState()[0]].cls}" style="border-radius:8px">${syncInner(...bannerState())}</div>
      <div class="card" style="padding:12px;display:grid;gap:4px"><div class="label">${T('Cached on this phone')}</div>
        <div>${T('{n} zone scores (6 zones × 4 times) from the {when} run', { n: rows().length, when: SCEN[S.scenario].when })}</div>
        <div><span class="num">${kb} KB</span> · ${T('budget under 5 KB, so it loads on 2G')}</div></div>
      <div class="label">${T('Reports waiting ({n})', { n: q.length })}</div>
      ${q.length ? `<div class="stack">${q.map(r => `<div>${reportPill('unconfirmed', `${hz(r.hazard)}, ${tr('zone {z}', { z: r.zone })}`)}</div>`).join('')}</div>` : `<p class="muted" style="margin:0">${T('Nothing waiting.')}</p>`}
      <button class="btn primary wide" id="sendnow" ${S.network === 'offline' || !q.length ? 'disabled' : ''}>${T('Send now')}</button>
      <div class="label">${T('Works offline')}</div><ul style="margin:0;padding-left:20px"><li>${T('Map and 48-hour strip from the cached scores')}</li><li>${T('Advisor on the cached scores, marked as cached')}</li><li>${T('Reports, queued until there is signal')}</li></ul>`;
  }
  function recipients(z) { return boardList().filter(t => DEST[t.dest].zones.includes(z)).length; }
  function dialogHtml() {
    const d = S.dialog;
    let title, body, ok, cls = 'primary';
    if (d.type === 'signout') {
      title = tr('Sign out?');
      body = S.queue.length ? tr(S.queue.length > 1 ? '{n} reports are still waiting to send. They stay on this phone and send when you have signal.' : '{n} report is still waiting to send. It stays on this phone and sends when you have signal.', { n: S.queue.length })
        : tr('You can sign in again with your mobile number and a new code.');
      ok = tr('Sign out');
    } else if (d.type === 'delete') {
      title = tr('Delete your account?');
      body = tr('Your name, phone number and trucks are erased within 30 days. Road reports you sent stay on the map without your name, so other drivers keep the warning. This cannot be undone.');
      ok = tr('Delete account'); cls = 'report';
    } else {
      const n = recipients(d.zone);
      title = tr('Publish this advisory?');
      body = tr('Zone {z} · {name}: {status}. Cause: {haz}.', { z: d.zone, name: tr(ZONE[d.zone].name), status: tr(STATUS[d.status]), haz: hz(d.hazard) }) + ' '
        + (n ? tr(n > 1 ? '{n} drivers routed through this zone get a push alert now.' : '{n} driver routed through this zone gets a push alert now.', { n }) : tr('No drivers are routed through this zone right now; the update still shows on the map.'));
      ok = tr('Publish'); cls = 'rail';
    }
    return `<div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t" aria-describedby="dlg-b"><h3 id="dlg-t">${esc(title)}</h3><p id="dlg-b" style="margin:0">${esc(body)}</p>
      <div class="acts"><button class="btn ${cls} wide" id="dlg-ok">${esc(ok)}</button><button class="btn wide" id="dlg-cancel">${T('Cancel')}</button></div></div>`;
  }

  /* ---------------------------------------------------------------- desktop control room */
  function desktop() {
    const h = S.horizon, police = S.role === 'police';
    const strip = `<table class="strip"><thead><tr><th class="z">${T('Zone')}</th>${[0, 12, 24, 48].map(x => `<th>${esc(hl(x))}</th>`).join('')}</tr></thead><tbody>${[1, 2, 3, 4, 5, 6].map(z => `<tr><th class="z">${z} ${T(ZONE[z].short)}</th>${[0, 12, 24, 48].map(x => { const r = get(z, x); return `<td><button class="cellbtn lv-${r.level}" data-zone="${z}" data-h="${x}"><span>${r.overall.toFixed(2)}</span><span class="lv">${T(r.level)}</span></button></td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
    const board = `<table class="t" style="font-size:14px"><thead><tr><th>#</th><th>${T('Truck')}</th><th>${T('Lot')}</th><th>${T('Last seen')}</th><th>${T('Advice')}</th><th>${T('Priority')}</th></tr></thead><tbody>${boardList().map((t, i) => `<tr><td>${i + 1}</td><td class="num" style="white-space:nowrap">${esc(t.truck)}</td><td>${esc(t.tonnes + ' t ' + t.variety)}<br><span class="muted">${T('to {dest}', { dest: tr(DEST[t.dest].name) })}</span></td><td>${esc(seenText(t))}</td><td><span class="badge" style="--c-bg:var(--${t.d.advice.toLowerCase()}-bg);--c-text:var(--${t.d.advice.toLowerCase()}-text)">${T(t.d.advice)}</span></td><td class="num">${t.d.priority.toFixed(2)}</td></tr>`).join('')}</tbody></table>`;
    let w = null; rows().forEach(r => { if (!w || LV[r.level] > LV[w.level] || (r.level === w.level && r.overall > w.overall)) w = r; });
    const right = police ? `<div class="label">${T('TCU official advisory')}</div>${tcuForm(true)}${pendingList()}`
      : `${reportList() || `<div class="label">${T('Road reports')}</div><p class="muted">${T('No reports.')}</p>`}<div class="label">${T('Most at-risk zone · {when}', { when: tr(HL[w.horizon_hours]) })}</div>${zoneCard(w.zone_id, w)}`;
    const [bk, bt] = bannerState();
    return `<div class="desk"><div class="dhead"><div style="display:flex;gap:12px;align-items:center">${milestone()}<strong style="font:700 22px var(--f-display)">${T('RouteGuard control room')}</strong><span>${T('NH-44 Jammu to Srinagar · {role} view', { role: tr(ROLE[police ? 'police' : 'agent']) })}</span></div>
      <div class="sync ${SYNC[bk].cls}" style="max-width:520px;border-radius:8px">${syncInner(bk, bt)}</div></div>
      <div class="dbody"><div class="col"><div class="label">${T('Risk map · {when}', { when: tr(HL[h]) })}</div>${horizonChips()}<div class="mapbox" style="height:560px;display:grid;place-items:center">${mapSvg(h, true)}</div>${legend()}</div>
      <div class="col"><div class="label">${T('48-hour strip')}</div>${strip}<div class="label">${T('Shipment board (sample trucks)')}</div>${board}</div>
      <div class="col">${right}</div></div>
      ${S.dialog ? `<div class="dscrim" data-cancel></div>${dialogHtml()}` : ''}<div class="toast" id="dtoast" role="status" aria-live="polite"></div></div>`;
  }

  /* ---------------------------------------------------------------- render */
  const phone = $('#phone'), stage = $('#stage');
  let deskEl = null, lastKey = null, lastDialog = null, timer = null, TOAST = null, toastT;
  function headerHtml() {
    const sub = S.tab === 'alerts' || S.tab === 'profile';
    const title = S.role === 'police' && S.tab === 'report' ? tr('TCU console') : tr(TITLES[S.tab]);
    const n = unread();
    return `${sub ? `<button class="hbtn" id="ab-back" aria-label="${T('Back')}">←</button>` : ''}<div class="ttl"><div class="t">${esc(title)}</div><div class="role">${T(ROLE[me().role])}</div></div>
      <button class="hbtn" id="ab-bell" aria-label="${T(n ? 'Alerts, {n} new' : 'Alerts', { n })}">${icon('nav-alerts')}${n ? `<span class="count small-ok">${n}</span>` : ''}</button>
      <button class="hbtn" id="ab-me" aria-label="${T('Profile and settings')}"><span class="av">${esc(initials(me().name))}</span></button>`;
  }
  function render() {
    ['scenario', 'network', 'edge', 'role', 'device'].forEach(k => { $('#sim-' + k).value = S[k]; });
    $('#sim-session').value = S.auth ? 'out' : 'in';
    $('#data-note').textContent = `${SCEN[S.scenario].label}. ${S.scenario === 'live' ? D.live.source : D.replay.source}. People, trucks, phones and road reports are sample data. Advice uses placeholder shelf-life and price values.`;
    if (S.device === 'desktop') {
      phone.style.display = 'none';
      if (!deskEl) { deskEl = document.createElement('div'); stage.appendChild(deskEl); }
      deskEl.innerHTML = desktop();
      stage.classList.add('desktop-mode');
      $('.proto-layout').style.gridTemplateColumns = '1fr';
      showToast();
      if (S.dialog && lastDialog !== S.dialog.type) $('#dlg-cancel', deskEl).focus();
      lastDialog = S.dialog && S.dialog.type;
      return;
    }
    phone.style.display = '';
    if (deskEl) { deskEl.remove(); deskEl = null; }
    stage.classList.remove('desktop-mode');
    $('.proto-layout').style.gridTemplateColumns = '';
    phone.classList.toggle('signed-out', !!S.auth);
    const scr = $('#screen');
    let html;
    if (S.auth) {
      html = { welcome: scrWelcome, otp: scrOtp, create: scrCreate }[S.auth]();
    } else {
      $('#appbar').innerHTML = headerHtml();
      $('#appbar').classList.toggle('sub', S.tab === 'alerts' || S.tab === 'profile');
      const [bk, bt] = bannerState();
      const ban = $('#banner'); ban.className = 'sync ' + SYNC[bk].cls; ban.innerHTML = syncInner(bk, bt);
      ban.setAttribute('aria-label', tr('Connection status. Opens the offline and sync drawer') + ': ' + bt);
      $('#bnav').innerHTML = bottomNav(S.tab);
      $('#bnav').setAttribute('aria-label', tr('Main'));
      if (S.edge === 'loading' && S.tab !== 'profile') html = skeleton();
      else if (S.edge === 'empty' && emptyState()) html = emptyState();
      else if (S.edge === 'error' && errorState()) html = errorState();
      else html = { map: scrMap, strip: scrStrip, advisor: scrAdvisor, board: scrBoard, report: scrReport, alerts: scrAlerts, profile: scrProfile }[S.tab]();
    }
    scr.innerHTML = html;
    const key = (S.auth || S.tab) + (S.tab === 'report' ? S.report.step : '');
    if (key !== lastKey) { scr.classList.remove('enter'); void scr.offsetWidth; scr.classList.add('enter'); scr.scrollTop = 0; lastKey = key; }
    const sh = $('#sheet');
    if (!S.auth && (S.sheet || S.drawer)) { sh.innerHTML = S.drawer ? sheetDrawer() : S.sheet.type === 'ship' ? sheetShip() : sheetZone(); phone.classList.add('open'); sh.removeAttribute('aria-hidden'); }
    else { phone.classList.remove('open'); sh.innerHTML = ''; sh.setAttribute('aria-hidden', 'true'); }
    const dl = $('#dialog');
    if (S.dialog) { dl.innerHTML = dialogHtml(); phone.classList.add('dlg'); if (lastDialog !== S.dialog.type) $('#dlg-cancel').focus(); }
    else { dl.innerHTML = ''; phone.classList.remove('dlg'); }
    lastDialog = S.dialog && S.dialog.type;
    $('#notice').innerHTML = S.auth === 'otp' && S.sms ? `<button class="sms" id="sms"><span class="from">${icon('nav-alerts', 'ico sm')}SMS · RouteGuard</span><span>${T('{code} is your RouteGuard code. It expires in 5 minutes. Tap to fill it in.', { code: CODE })}</span></button>` : '';
    tick();
    showToast();
  }
  /* the resend countdown only updates its own line, so typing is never interrupted */
  function tick() {
    clearInterval(timer);
    if (S.auth !== 'otp' || resendLeft() === 0) return;
    timer = setInterval(() => { const b = $('#au-resend-box'); if (!b || S.auth !== 'otp') { clearInterval(timer); return; } b.innerHTML = resendHtml(); if (!resendLeft()) clearInterval(timer); }, 1000);
  }
  function toast(msg) { TOAST = msg; }
  function showToast() {
    if (!TOAST) return;
    const t = S.device === 'desktop' ? $('#dtoast') : $('#toast');
    t.textContent = TOAST; TOAST = null; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3200);
  }

  function flushQueue() {
    if (!S.queue.length || S.network === 'offline') return 0;
    const n = S.queue.length;
    S.sent.push(...S.queue.map(r => ({ ...r, mins: 0 })));
    S.queue = [];
    toast(tr(n > 1 ? '{n} queued reports sent' : '{n} queued report sent', { n }));
    return n;
  }
  function readLot() {
    const f = $('#lotform'); if (!f) return;
    const fd = new FormData(f);
    S.lot = { variety: fd.get('variety'), days: Math.max(0, +fd.get('days') || 0), tonnes: Math.max(1, +fd.get('tonnes') || 1), dest: fd.get('dest'), type: fd.get('type'), truck: (fd.get('truck') || 'JK05 G 7712').toString().trim() || 'JK05 G 7712' };
  }
  function signIn(u, msg) {
    S.me = u; S.role = u.role; S.auth = null; S.tab = ROLE_TAB[u.role]; S.sms = false; S.signin.busy = false;
    S.report = { step: 1, hazard: null, zone: null };
    toast(msg);
  }
  function sendCode() {
    const si = S.signin;
    if (digits(si.phone).length !== 10) { si.err = 'phone'; return; }
    if (S.network === 'offline') { si.err = 'nosignal'; return; }
    if (S.edge === 'error') { si.err = 'server'; return; }
    si.err = null; si.busy = true;
    later(() => { si.busy = false; si.code = ''; si.sentAt = Date.now(); S.auth = 'otp'; S.sms = true; render(); }, 700);
  }
  function verify() {
    const si = S.signin;
    if (si.code.length < 6) { si.err = 'short'; return; }
    if (S.edge === 'error' || resendLeft() === 0 && Date.now() - si.sentAt > 300000) { si.err = 'expired'; return; }
    if (si.code !== CODE) { si.err = 'wrong'; return; }
    si.err = null; si.busy = true;
    later(() => {
      si.busy = false;
      const d = digits(si.phone);
      const known = S.me && digits(S.me.phone) === d ? S.me : Object.entries(PEOPLE).filter(([, p]) => p.phone === d).map(([role, p]) => ({ ...p, role }))[0];
      if (known) signIn(known, tr('Welcome back, {name}.', { name: known.name }));
      else { S.auth = 'create'; S.sms = false; si.errs = {}; }
      render();
    }, 600);
  }
  function readCreate(f) {
    const fd = new FormData(f), si = S.signin;
    ['name', 'truck', 'agent', 'firm', 'village'].forEach(k => { if (fd.has(k)) si[k] = String(fd.get(k)).trim(); });
    si.role = fd.get('role') || null;
  }
  function createAccount(f) {
    readCreate(f);
    const si = S.signin;
    si.errs = { name: !si.name, role: !si.role };
    if (si.errs.name || si.errs.role) return;
    if (S.edge === 'error' && !si.failed) { si.failed = true; return; } // first try fails in the error state; the retry works
    si.failed = false; si.busy = true;
    later(() => {
      const u = { name: si.name, phone: si.phone, role: si.role, verified: si.role === 'driver' ? false : undefined };
      S.alertZones = si.alerts ? [3, 4, 5] : [];
      signIn(u, tr(si.role === 'driver' ? 'Account created. Your agent will confirm your truck.' : 'Account created. Welcome, {name}.', { name: si.name }));
      render();
    }, 700);
  }

  /* events: one delegated listener on the phone and the desktop view */
  function onClick(e) {
    phone.classList.remove('instant');
    const t = e.target.closest('button, polygon.hex, .dscrim');
    if (!t) { if (e.target.id === 'scrim') { if (S.dialog) S.dialog = null; else { S.sheet = null; S.drawer = false; } render(); } return; }
    const d = t.dataset;
    if (t.disabled) return;
    if (t.id === 'au-send') { sendCode(); }
    else if (t.id === 'au-back') { S.auth = 'welcome'; S.sms = false; S.signin.err = null; }
    else if (t.id === 'au-verify') { verify(); }
    else if (t.id === 'au-resend') { S.signin.sentAt = Date.now(); S.signin.err = null; S.signin.code = ''; S.sms = true; S.edge = S.edge === 'error' ? 'normal' : S.edge; }
    else if (t.id === 'sms') { S.signin.code = CODE; S.signin.err = null; S.sms = false; }
    else if (d.sw) { S.signin[d.sw] = !S.signin[d.sw]; const f = $('#au-create'); if (f) readCreate(f); }
    else if (d.nav) { S.tab = d.nav; S.sheet = null; S.drawer = false; if (d.nav === 'report' && S.report.step > 3) S.report = { step: 1, hazard: null, zone: null }; }
    else if (t.id === 'ab-bell') { if (S.tab !== 'alerts') S.back = S.tab; S.tab = 'alerts'; S.sheet = null; openAlerts(); }
    else if (t.id === 'ab-me' || d.go === 'profile') { if (S.tab !== 'profile' && S.tab !== 'alerts') S.back = S.tab; S.tab = 'profile'; S.sheet = null; }
    else if (t.id === 'ab-back') { S.tab = S.back || 'map'; }
    else if (d.az) { const z = +d.az; S.alertZones = S.alertZones.includes(z) ? S.alertZones.filter(x => x !== z) : [...S.alertZones, z].sort(); }
    else if (t.id === 'pf-signout') S.dialog = { type: 'signout' };
    else if (t.id === 'pf-delete') S.dialog = { type: 'delete' };
    else if (t.id === 'dlg-cancel' || d.cancel !== undefined) S.dialog = null;
    else if (t.id === 'dlg-ok') {
      const dg = S.dialog; S.dialog = null;
      if (dg.type === 'signout') { const ph = me().phone; S.me = me(); S.auth = 'welcome'; S.signin = freshSignin(ph); S.tab = 'map'; toast(tr('Signed out. Unsent reports stay on this phone.')); }
      else if (dg.type === 'delete') { S.me = null; S.auth = 'welcome'; S.signin = freshSignin(''); S.queue = []; S.tab = 'map'; toast(tr('Account deleted. Your reports stay on the map without your name.')); }
      else {
        S.tcu = { zone: dg.zone, status: dg.status, hazard: dg.hazard };
        S.overrides[dg.zone] = { status: dg.status, hazard: dg.hazard };
        S.zone = dg.zone;
        const n = recipients(dg.zone);
        toast(tr('Published. Zone {z} now shows police-confirmed, confidence High.', { z: dg.zone }) + ' ' + (n ? tr(n > 1 ? '{n} drivers alerted.' : '{n} driver alerted.', { n }) : tr('No drivers on this zone right now.')));
      }
    }
    else if (t.id === 'banner' || d.open === 'drawer') { if (S.edge === 'error' && t.id === 'banner') { S.edge = 'normal'; toast(tr('Connected again')); } else { S.drawer = true; S.sheet = null; } }
    else if (d.close !== undefined) { S.sheet = null; S.drawer = false; }
    else if (d.ship) { S.sheet = { type: 'ship', id: d.ship }; }
    else if (d.call) { toast(tr('Opening the phone app to call {p}', { p: d.call })); }
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
      if (S.network === 'offline') { S.queue.push(r); toast(tr('Saved on this phone. It sends when you have signal.')); }
      else { S.sent.push({ ...r, mins: 0 }); toast(tr('Report sent to the TCU control room')); }
      S.report = { step: 1, hazard: null, zone: null }; S.tab = 'map';
    }
    else if (t.id === 'sendnow') flushQueue();
    else if (t.id === 'commit') {
      const id = 'c' + (S.committed.length + 1);
      S.committed.push({ ...S.lot, id, phone: '98•• ••• 521' }); // Gurpreet Singh drives JK05 G 7712
      S.newId = id; S.advice = null; S.tab = 'board'; S.boardFilter = 'all';
      const rank = boardList().findIndex(x => x.id === id) + 1;
      toast(tr('{truck} added to the board at #{rank}', { truck: S.lot.truck, rank }));
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
    if (e.target.id === 'au-create') createAccount(e.target);
    if (e.target.id === 'tcuform') {
      const fd = new FormData(e.target);
      S.tcu = { zone: +fd.get('zone'), status: fd.get('status'), hazard: fd.get('hazard') };
      S.dialog = { type: 'publish', ...S.tcu };
    }
    render();
  }
  /* typing never re-renders the screen: it updates the state and the one element that shows it */
  function onInput(e) {
    const t = e.target, si = S.signin;
    if (t.id === 'au-phone') { si.phone = digits(t.value).slice(0, 10); if (si.err) { si.err = null; t.closest('.tel').classList.remove('bad'); t.removeAttribute('aria-invalid'); $('#au-err')?.remove(); } }
    if (t.id === 'au-code') {
      si.code = digits(t.value).slice(0, 6); if (t.value !== si.code) t.value = si.code;
      $$('.otp .boxes span').forEach((b, i) => { b.textContent = si.code[i] || ''; b.classList.toggle('cur', i === Math.min(si.code.length, 5)); });
      if (si.err) { si.err = null; t.closest('.otp').classList.remove('bad'); t.removeAttribute('aria-invalid'); $('#au-err')?.remove(); }
    }
  }
  stage.addEventListener('click', onClick); // one listener: the phone and the desktop view both live in #stage
  stage.addEventListener('submit', onSubmit);
  stage.addEventListener('input', onInput);
  stage.addEventListener('change', e => { if (e.target.name === 'role' && e.target.form && e.target.form.id === 'au-create') { readCreate(e.target.form); S.signin.errs.role = false; render(); } });
  stage.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.id === 'au-phone') { e.preventDefault(); sendCode(); render(); }
    if (e.key === 'Enter' && e.target.id === 'au-code') { e.preventDefault(); verify(); render(); }
    if (e.key === 'Escape' && (S.dialog || S.sheet || S.drawer)) { if (S.dialog) S.dialog = null; else { S.sheet = null; S.drawer = false; } render(); }
  });
  ['scenario', 'network', 'edge', 'role', 'device'].forEach(k => $('#sim-' + k).addEventListener('change', e => {
    S[k] = e.target.value;
    if (k === 'role') { S.me = null; S.auth = null; S.tab = ROLE_TAB[S.role]; S.sheet = null; S.drawer = false; S.dialog = null; }
    if (k === 'scenario') { S.advice = S.advice ? decide(S.lot) : null; S.overrides = {}; S.pendingDone = {}; }
    if (k === 'network') flushQueue();
    render();
  }));
  $('#sim-session').addEventListener('change', e => {
    if (e.target.value === 'out') { S.auth = 'welcome'; S.signin = freshSignin('9876543210'); S.sheet = null; S.drawer = false; S.dialog = null; }
    else { S.auth = null; S.sms = false; }
    render();
  });

  /* ---------------------------------------------------------------- test hooks used by scripts/verify_round2_all.py */
  function applyState(st) {
    S = DEFAULT();
    clearTimeout(toastT); TOAST = null; $('#toast').classList.remove('show');
    if (!st || st.name === 'reset') { S.auth = 'welcome'; lastKey = null; render(); return true; }
    Object.entries(st).forEach(([k, v]) => { if (k in S && k !== 'report' && k !== 'signin') S[k] = v; });
    if (st.role && !st.tab) S.tab = ROLE_TAB[st.role];
    if (st.report) S.report = { ...S.report, ...st.report };
    if (st.signin) S.signin = { ...S.signin, ...st.signin };
    if (st.auth === 'otp' && !(st.signin && st.signin.sentAt)) S.signin.sentAt = Date.now() - 6000;
    if (st.queue) S.queue = st.queue.map((r, i) => ({ id: 'q' + i, src: 'unconfirmed', ...r }));
    if (st.override) S.overrides = st.override;
    if (S.tab === 'alerts') openAlerts();
    if (st.run) S.advice = decide(S.lot);
    phone.classList.add('instant');
    render();
    return true;
  }
  const DRIVER_Q = [{ hazard: 'rockfall', zone: 4, place: 'Digdol' }];
  const AUDIT = [
    { name: 'signin_welcome', auth: 'welcome' },
    { name: 'signin_phone_error', auth: 'welcome', signin: { phone: '98765', err: 'phone' } },
    { name: 'signin_no_signal', auth: 'welcome', network: 'offline', signin: { err: 'nosignal' } },
    { name: 'signin_otp', auth: 'otp', sms: true, signin: { code: '4182' } },
    { name: 'signin_otp_wrong', auth: 'otp', signin: { code: '418270', err: 'wrong' } },
    { name: 'signin_otp_expired', auth: 'otp', edge: 'error', signin: { code: '418207', err: 'expired', sentAt: 1 } },
    { name: 'signin_create', auth: 'create' },
    { name: 'signin_create_errors', auth: 'create', signin: { name: '', role: null, errs: { name: true, role: true } } },
    { name: 'map_replay', tab: 'map' },
    { name: 'map_live', scenario: 'live', tab: 'map' },
    { name: 'map_replay_plus24', tab: 'map', horizon: 24 },
    { name: 'zone_sheet_replay', tab: 'map', sheet: { type: 'zone', zone: 4 } },
    { name: 'strip_replay', tab: 'strip' },
    { name: 'strip_daybefore', scenario: 'daybefore', tab: 'strip' },
    { name: 'advisor_form', tab: 'advisor' },
    { name: 'advice_send_live', scenario: 'live', tab: 'advisor', run: true },
    { name: 'advice_rail_replay', tab: 'advisor', run: true },
    { name: 'advice_divert_replay', tab: 'advisor', run: true, lot: { variety: 'Ambri', days: 4, tonnes: 9, dest: 'azadpur', type: 'multi', truck: 'JK13 D 0921' } },
    { name: 'advice_send_valley_daybefore', scenario: 'daybefore', tab: 'advisor', run: true, lot: { variety: 'Delicious', days: 3, tonnes: 10, dest: 'parimpora', type: 'multi', truck: 'JK03 F 2214' } },
    { name: 'board_agent', role: 'agent' },
    { name: 'ship_detail', role: 'agent', sheet: { type: 'ship', id: 's0' } },
    { name: 'board_empty', role: 'agent', edge: 'empty' },
    { name: 'report_step1_offline', role: 'driver', network: 'offline' },
    { name: 'report_step2_gps_denied', role: 'driver', edge: 'error', report: { step: 2, hazard: 'rockfall' } },
    { name: 'report_step3', role: 'driver', report: { step: 3, hazard: 'landslide' } },
    { name: 'offline_queue_drawer', role: 'driver', network: 'offline', drawer: true, queue: DRIVER_Q },
    { name: 'stale_banner', network: 'stale', tab: 'map' },
    { name: 'tcu_console', role: 'police' },
    { name: 'tcu_publish_confirm', role: 'police', dialog: { type: 'publish', zone: 4, status: 'closed', hazard: 'landslide' } },
    { name: 'tcu_after_publish', role: 'police', tab: 'map', scenario: 'live', override: { 4: { status: 'closed', hazard: 'landslide' } } },
    { name: 'alerts_driver', role: 'driver', tab: 'alerts', network: 'stale', queue: DRIVER_Q },
    { name: 'alerts_empty', role: 'driver', tab: 'alerts', scenario: 'live' },
    { name: 'profile_driver', role: 'driver', tab: 'profile' },
    { name: 'dialog_signout', role: 'driver', tab: 'profile', queue: DRIVER_Q, dialog: { type: 'signout' } },
    { name: 'dialog_delete', role: 'driver', tab: 'profile', dialog: { type: 'delete' } },
    { name: 'loading', edge: 'loading', tab: 'map' },
    { name: 'error_offline_copy', edge: 'error', tab: 'map' },
  ];
  function selfTest() {
    const fail = [];
    const click = sel => { const el = typeof sel === 'string' ? stage.querySelector(sel) : sel; if (!el) { fail.push(`cannot find ${sel}`); return false; } el.click(); return true; };
    const type = (sel, v) => { const el = stage.querySelector(sel); if (!el) { fail.push(`cannot find ${sel}`); return; } el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
    const expect = (c, m) => { if (!c) fail.push(m); };
    FAST = true;
    try {
      // Flow D: phone -> wrong code -> right code -> new account -> the driver's first tab
      applyState({ name: 'test', auth: 'welcome' });
      type('#au-phone', '98765'); click('#au-send');
      expect(S.signin.err === 'phone' && !!$('#au-err'), 'a 5-digit number did not show the phone error');
      type('#au-phone', '98765 43210'); click('#au-send');
      expect(S.auth === 'otp' && !!$('#sms'), 'Send code did not open the OTP screen with the SMS');
      type('#au-code', '111111'); click('#au-verify');
      expect(S.signin.err === 'wrong' && !!$('#au-err'), 'a wrong code did not show the error');
      click('#sms'); click('#au-verify');
      expect(S.auth === 'create', 'a right code for a new number did not open Create account');
      type('#au-create input[name=name]', ''); click('#au-create-go');
      expect(S.signin.errs.name, 'an empty name was accepted');
      type('#au-create input[name=name]', 'Gurpreet Singh'); click('#au-create-go');
      expect(S.auth === null && S.role === 'driver' && S.tab === 'report' && S.me && S.me.verified === false, 'Create account did not sign in an unverified driver on the Report tab');
      // returning user skips Create account
      applyState({ name: 'test', auth: 'otp', signin: { phone: PEOPLE.grower.phone } });
      type('#au-code', CODE); click('#au-verify');
      expect(S.auth === null && S.role === 'grower' && S.tab === 'map', 'a known number did not go straight to the map');
      // Flow A, live run: advisor -> SEND -> commit -> board
      applyState({ name: 'test', scenario: 'live' });
      click('[data-nav=advisor]');
      expect(!!$('#lotform', phone), 'advisor form did not open');
      click('#getadvice');
      expect($('.decision', phone)?.dataset.advice === 'SEND', 'live run should give SEND for the default lot');
      click('#commit');
      expect(S.tab === 'board', 'commit did not open the board');
      expect(!!$('.ship.new', phone), 'committed truck is not highlighted on the board');
      const ranks = boardList().map(t => t.d.priority);
      expect(ranks.every((v, i) => i === 0 || ranks[i - 1] >= v), 'board is not sorted by priority');
      click('.ship.new');
      expect(S.sheet && S.sheet.type === 'ship' && /orchard/.test($('#sheet').textContent), 'the committed truck has no detail sheet');
      // Flow A, replay: same lot -> RAIL (zones 3-5 high at +24 and +48, 57% shelf life used)
      applyState({ name: 'test' });
      click('[data-nav=advisor]'); click('#getadvice');
      expect($('.decision', phone)?.dataset.advice === 'RAIL', 'replay should give RAIL for the default lot');
      // Flow B: offline driver report in 3 taps, queued, then sent when online
      applyState({ name: 'test', role: 'driver', network: 'offline' });
      click('[data-haz=rockfall]'); click('#rp-place'); click('#rp-send');
      expect(S.queue.length === 1, 'offline report was not queued');
      expect(/waiting/.test($('#banner').textContent), 'banner does not count the queued report');
      const net = $('#sim-network'); net.value = 'online'; net.dispatchEvent(new Event('change'));
      expect(S.queue.length === 0 && S.sent.length === 1, 'queued report was not sent when back online');
      // Flow C: police publish a closure, confirm it -> zone 4 high, confidence high
      applyState({ name: 'test', role: 'police', scenario: 'live' });
      const zs = $('#tcuform select[name=zone]', phone); zs.value = '4';
      click('#tcu-publish');
      expect(S.dialog && S.dialog.type === 'publish' && !!$('#dlg-ok'), 'Publish did not ask for confirmation');
      expect(get(4, 0).confidence !== 'high' || get(4, 0).level !== 'high', 'the closure was applied before it was confirmed');
      click('#dlg-ok');
      expect(get(4, 0).confidence === 'high' && get(4, 0).level === 'high', 'TCU closure did not set zone 4 to high / high confidence');
      // alerts: the bell counts new ones, opening the inbox clears it, an alert opens its zone
      applyState({ name: 'test', role: 'driver' });
      const n0 = unread();
      expect(n0 > 0 && /\d/.test($('#ab-bell').textContent), 'the bell shows no count in the replay');
      click('#ab-bell');
      expect(S.tab === 'alerts' && unread() === 0, 'opening alerts did not clear the count');
      click('.alert[data-zone]');
      expect(S.sheet && S.sheet.type === 'zone', 'an alert did not open its zone');
      // profile: sign out asks first, then goes back to the welcome screen
      applyState({ name: 'test', role: 'driver', queue: DRIVER_Q });
      click('#ab-me'); click('#pf-signout');
      expect(S.dialog && /waiting/.test($('#dialog').textContent), 'sign out did not warn about the waiting report');
      click('#dlg-cancel');
      expect(!S.dialog && S.auth === null, 'Cancel did not keep the user signed in');
      click('#pf-signout'); click('#dlg-ok');
      expect(S.auth === 'welcome' && S.queue.length === 1, 'sign out did not return to welcome with the report kept');
      // edge states render
      ['loading', 'empty', 'error'].forEach(ed => { applyState({ name: 'test', edge: ed }); expect($('#screen').textContent.trim().length > 0, `edge state ${ed} is blank`); });
      // offline drawer shows a cache under 5 KB
      applyState({ name: 'test', network: 'offline' });
      expect(cacheBytes() < 5120, `cached summary is ${cacheBytes()} bytes, over 5 KB`);
      click('#banner');
      expect(phone.classList.contains('open') && /KB/.test($('#sheet').textContent), 'offline drawer did not open from the banner');
    } catch (err) { fail.push('exception: ' + err.message); }
    FAST = false;
    applyState({ name: 'reset' });
    return fail;
  }
  window.RG = { applyState, auditStates: () => AUDIT, selfTest, decide: lot => decide(lot), state: () => S };

  S.auth = 'welcome';
  render();
