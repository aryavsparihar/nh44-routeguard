/* Style guide and wireframe documents (printed to PDF by build.py). */
  if ($('#swatches')) {
  $('#swatches').innerHTML = Object.entries(C).map(([k, hex]) => {
    const onW = ratio(C['text.inverse'], hex), onD = ratio(C['text.primary'], hex);
    const fg = onW >= onD ? C['text.inverse'] : C['text.primary'];
    const r = Math.max(onW, onD);
    return `<div class="swatch"><div class="chip" style="background:${hex};color:${fg}">Aa</div>
      <div class="meta"><strong>${esc(k)}</strong><br><span class="num">${hex}</span> · ${onW >= onD ? 'white' : 'ink'} text ${r.toFixed(2)}:1 <span class="pill ${r >= 4.5 ? 'ok' : r >= 3 ? 'part' : 'todo'}">${grade(r)}</span></div></div>`;
  }).join('');
  $('#pairs tbody').innerHTML = D.tokens.contrast_pairs.map(p => {
    const r = ratio(C[p.fg], C[p.bg]);
    return `<tr><td><span style="display:inline-block;padding:4px 10px;border-radius:4px;background:${C[p.bg]};color:${C[p.fg]};font-weight:700;border:1px solid var(--border-default)">Aa ${p.decision ? esc(p.use.split(' ')[0]) : 'text'}</span></td>
      <td><code>${esc(p.fg)}</code></td><td><code>${esc(p.bg)}</code></td><td>${esc(p.use)}</td>
      <td class="num">${r.toFixed(2)}:1</td><td>${p.min}:1 <span class="pill ${r >= p.min ? 'ok' : 'todo'}">${r >= p.min ? 'pass' : 'fail'}</span></td></tr>`;
  }).join('');
  $('#rejected').innerHTML = D.tokens.rejected_pairs.map(p => `<li><code>${esc(p.fg)}</code> on <code>${esc(p.bg)}</code>: ${esc(/:1/.test(p.why) ? p.why : ratio(C[p.fg], C[p.bg]).toFixed(2) + ':1, ' + p.why)}</li>`).join('');
  $('#typescale').innerHTML = Object.entries(D.tokens.type).map(([k, t]) => {
    const fam = t.family === D.tokens.type.display.family ? 'var(--f-display)' : t.family === D.tokens.type.body.family ? 'var(--f-ui)' : 'var(--f-data)';
    const st = `font-family:${fam};font-size:${t.size}px;line-height:${t.line}px;font-weight:${t.weight};${t.upper ? 'text-transform:uppercase;letter-spacing:.06em' : ''}`;
    const sample = k === 'data' ? '0.70 · range 0.45 to 0.95 · +24 h' : k === 'label' ? 'Zone 4 · Ramban' : k === 'decision' ? 'Rail · Hold 6 h' : 'Send the lot before Ramban closes';
    return `<div class="type-row"><div><strong>${esc(k)}</strong><br><span class="muted">${esc(t.family)} ${t.size}/${t.line} · ${t.weight}</span></div><div style="${st}">${esc(sample)}</div></div>`;
  }).join('');
  $('#spacing').innerHTML = Object.entries(D.tokens.space).map(([k, v]) => `<div class="space-row"><code style="width:70px">space.${k}</code><div class="bar" style="width:${v * 4}px"></div><span class="num">${v} px</span></div>`).join('')
    + `<p class="muted" style="margin-top:8px">Touch targets: at least ${D.tokens.touch_min_px} px. Radius: ${Object.entries(D.tokens.radius).map(([k, v]) => `${k} ${v}`).join(', ')}.</p>`;
  $('#icons').innerHTML = $$('symbol[id^="i-"]').map(s => `<div class="icon-cell"><svg class="ico big" aria-hidden="true"><use href="#${s.id}"/></svg>
    <div style="display:flex;gap:8px">${icon(s.id.slice(2))}${icon(s.id.slice(2), 'ico sm')}</div><strong>${esc(s.dataset.title)}</strong><code>${esc(s.id.slice(2))}.svg</code></div>`).join('');

  }

  /* every variant of the 5 component sets, as they are in the Figma file */
  if ($('#components')) {
    const WHY = { SEND: 'All 6 zones stay low for 24 h. Leave in the next 12 h.', HOLD: 'Zone 3 is medium at +12 h. Wait 6 h and check again.',
      RAIL: 'Zones 3 to 5 stay high at +24 h and +48 h. Book a Budgam–Delhi parcel slot.', DIVERT: 'Light truck: take Mughal Road instead of NH-44.' };
    const card = (lvl, conf) => zoneCard(4, { level: lvl, confidence: conf, overall: { low: 0.15, medium: 0.42, high: 0.71 }[lvl],
      risk_low: { low: 0, medium: 0.2, high: 0.46 }[lvl], risk_high: { low: 0.35, medium: 0.64, high: 0.96 }[lvl], top_hazard: 'landslide',
      reason: 'Landslide: rain over 72 h near Ramban' });
    const SY = [['Online Live', 'live', 'Live · scores from the 18:34 UTC run'], ['Offline Cached <5KB', 'offline', 'Offline · cached scores from 2 h ago, 0.8 KB'],
      ['Stale Score >2h', 'stale', 'Scores are 3 h old · the hourly job missed a run'], ['Syncing Queued Report (2)', 'queued', 'Sending 2 queued reports…']];
    const v = (name, html) => `<figure class="variant"><figcaption>${esc(name)}</figcaption>${html}</figure>`;
    $('#components').innerHTML = `
      <section class="cset"><h3>Decision Banner <span class="muted">· Advice</span></h3><div class="vgrid">${Object.keys(ADV).map(a => v('Advice=' + a, decisionBanner(a, WHY[a]))).join('')}</div></section>
      <section class="cset"><h3>Zone Risk Card <span class="muted">· RiskLevel × Confidence</span></h3><div class="vgrid three">${['low', 'medium', 'high'].map(l => ['low', 'medium', 'high'].map(c => v(`RiskLevel=${cap(l)}, Confidence=${cap(c)}`, card(l, c))).join('')).join('')}</div></section>
      <section class="cset"><h3>Connectivity &amp; Sync Banner <span class="muted">· State</span></h3><div class="vgrid">${SY.map(([n, k, t]) => v('State=' + n, `<div class="sync ${SYNC[k].cls}">${syncInner(k, t)}</div>`)).join('')}</div></section>
      <section class="cset"><h3>Hazard Report Pill <span class="muted">· Source</span></h3><div class="vgrid">${[['Police Official', 'police'], ['Verified Driver', 'verified'], ['Unconfirmed Driver', 'unconfirmed']].map(([n, k]) => v('Source=' + n, reportPill(k, 'rockfall at Digdol'))).join('')}</div></section>
      <section class="cset"><h3>Bottom Nav Bar <span class="muted">· ActiveTab</span></h3><div class="vgrid">${[['Map', 'map'], ['48h Strip', 'strip'], ['Advisor', 'advisor'], ['Board', 'board'], ['Report', 'report']].map(([n, k]) => v('ActiveTab=' + n, `<div class="bnav" role="presentation">${bottomNav(k)}</div>`)).join('')}</div></section>`;
  }

  /* ---------------------------------------------------------------- wireframes */
  const B = (h, o = {}) => `<div class="wf-b ${o.c || ''}" style="height:${h}px;${o.s || ''}">${o.n ? `<span class="wf-n">${o.n}</span>` : ''}${o.t ? `<span class="wf-t">${o.t}</span>` : ''}</div>`;
  const R = (...xs) => `<div class="wf-row">${xs.join('')}</div>`;
  const F = (h, o = {}) => B(h, { ...o, s: 'flex:1;' + (o.s || '') });
  const top = (n) => B(26, { c: 'dark', t: 'title · role · bell · me', n }) + B(20, { t: 'sync banner' });
  const nav = B(38, { c: 'dark', t: 'bottom nav · 5 tabs', s: 'margin-top:auto' });
  const WF = [
    { t: '1 Risk map (home)', p: [top(1), R(F(22), F(22), F(22), F(22)), B(210, { t: 'map · hex cells by zone', n: 2 }), B(8, { c: 'txt', s: 'width:70%' }), R(F(34, { n: 3 }), F(34), F(34)), R(F(34), F(34), F(34)), R(F(18, { c: 'line' }), F(18, { c: 'line' })), nav],
      n: ['Green header on every screen: title and role, then the alerts bell and the profile badge. The banner under it opens the offline drawer.', 'Hexes coloured by level, with a pattern as well as colour. Tap one for the zone sheet.', 'Zone chips repeat the map as big buttons for one-handed use and screen readers.'] },
    { t: '2 Zone sheet (overlay)', p: [top(), B(120, { t: 'map, dimmed' }), B(220, { c: 'line', t: 'bottom sheet', n: 1, s: 'margin-top:auto;display:flex' }), nav],
      n: ['Level + confidence badges, score and range, the plain-language reason, the 4 hazard bars, past closures in this zone, and a "Plan a lot" button.'] },
    { t: '3 48-hour strip', p: [top(), B(30, { t: 'worst on route', n: 1 }), R(F(16, { c: 'txt' }), F(16, { c: 'txt' }), F(16, { c: 'txt' }), F(16, { c: 'txt' })), ...[1, 2, 3, 4, 5, 6].map(i => R(B(36, { s: 'width:52px' }), F(36, i === 1 ? { n: 2 } : {}), F(36), F(36), F(36))), B(8, { c: 'txt' }), nav],
      n: ['One sentence first: the worst zone and when.', '6 zones × 4 horizons. Each cell shows the number and the level word; tap for details.'] },
    { t: '4 Dispatch advisor (form)', p: [top(), B(30, { t: 'variety', n: 1 }), R(F(30, { t: 'days picked' }), F(30, { t: 'tonnes' })), B(10, { c: 'txt', s: 'width:40%' }), B(26), B(26), B(26), B(10, { c: 'txt', s: 'width:40%' }), R(F(26, { n: 2 }), F(26)), B(30, { t: 'truck no.' }), B(36, { c: 'dark', t: 'get advice', n: 3 }), nav],
      n: ['Five fields, all with defaults from the last lot.', 'Destination and truck type as big radio cards, not dropdowns.', 'One primary button.'] },
    { t: '5 Advice card', p: [top(), B(110, { c: 'dark', t: 'decision banner', n: 1 }), B(80, { t: 'worst zone card', n: 2 }), R(F(40, { t: 'delay' }), F(40, { t: 'priority' })), B(10, { c: 'txt' }), B(36, { c: 'dark', t: 'commit to board', n: 3 }), B(32, { c: 'line', t: 'change lot' }), nav],
      n: ['The answer in one word, an icon and one sentence of why.', 'The zone that drives the answer, with its confidence.', 'Commit sends the lot to the agent board.'] },
    { t: '6 Shipment board', p: [top(), R(F(30, { n: 1 }), F(30), F(30)), ...[1, 2, 3, 4].map(i => B(70, i === 1 ? { t: 'truck card', n: 2 } : { t: 'truck card' })), nav],
      n: ['Filter: all, moving, held.', 'Ranked by priority (spoilage × value). Each card: truck, lot, advice badge, last seen and ETA. Tap a card for the truck detail sheet (frame 18).'] },
    { t: '7 Report: what did you see', p: [top(), R(F(6, { c: 'dark' }), F(6), F(6)), B(14, { c: 'txt', s: 'width:60%' }), R(F(110, { n: 1 }), F(110)), R(F(110), F(110)), B(30, { c: 'line', t: 'offline note', n: 2 }), nav],
      n: ['Tap 1: four big hazard buttons (112 px tall) with shape icons.', 'Reports wait on the phone when there is no signal.'] },
    { t: '8 Report: where + send', p: [top(), R(F(6, { c: 'dark' }), F(6, { c: 'dark' }), F(6)), B(90, { t: 'photo, optional' }), B(50, { t: 'gps coords + zone', n: 1 }), B(36, { c: 'dark', t: 'this is the place', n: 2 }), B(36, { c: 'dark', t: 'send report', n: 3 }), nav],
      n: ['GPS fills the place. If location is off, the user taps a zone chip instead.', 'Tap 2: confirm place.', 'Tap 3: send. Offline, it is queued and the banner counts it.'] },
    { t: '9 TCU console (police)', p: [top(), B(30, { t: 'zone' }), R(F(34, { n: 1 }), F(34), F(34)), B(30, { t: 'hazard' }), B(36, { c: 'dark', t: 'publish advisory', n: 2 }), B(14, { c: 'txt', s: 'width:50%' }), B(60, { t: 'pending report', n: 3 }), B(60, { t: 'pending report' }), nav],
      n: ['Closed, one-way or open.', 'Publish asks once (frame 19), then sets the zone to confidence High and pushes to drivers in that zone.', 'Confirm or reject driver reports.'] },
    { t: '10 Offline drawer', p: [top(), B(100, { t: 'screen behind' }), B(240, { c: 'line', t: 'drawer', n: 1, s: 'margin-top:auto' }), nav],
      n: ['Cache age and size (under 5 KB), queued reports with a send button, and what still works offline.'] },
    { t: '11 Loading state', p: [top(), B(22, { s: 'width:60%' }), B(210, { n: 1 }), R(F(34), F(34), F(34)), B(60), nav],
      n: ['Grey skeleton in the same layout, so nothing jumps when scores arrive.'] },
    { t: '12 Empty and error states', p: [top(), B(60, { c: 'line', t: 'icon', n: 1, s: 'width:60px;align-self:center;margin-top:60px' }), B(12, { c: 'txt', s: 'width:70%;align-self:center' }), B(12, { c: 'txt', s: 'width:50%;align-self:center' }), B(36, { c: 'dark', t: 'retry / plan a lot', n: 2, s: 'width:70%;align-self:center' }), nav],
      n: ['Says what happened in plain words (no scores yet, no trucks, cannot reach server, location off).', 'One action to fix it.'] },
    { t: '13 Welcome + phone number', p: [B(40, { t: 'routeguard · one line on what it does', n: 1, s: 'margin-top:40px' }), B(10, { c: 'txt', s: 'width:70%' }), B(76, { c: 'line', t: 'what you get · 3 lines', n: 2 }), B(10, { c: 'txt', s: 'width:45%;margin-top:16px' }), B(40, { t: '+91 · mobile number', n: 3 }), B(36, { c: 'dark', t: 'send code' }), B(10, { c: 'txt', s: 'width:80%' })],
      n: ['App name and one line on what it does. No bottom nav before sign-in.', 'Three short lines on what the app gives: risk for each zone up to 48 h, one answer per lot, works with no signal.', 'Phone number only, no password. +91 is fixed and the keypad is numeric.'] },
    { t: '14 OTP check', p: [B(26, { t: 'back · enter the code' }), B(10, { c: 'txt', s: 'width:75%' }), R(F(44, { n: 1 }), F(44), F(44), F(44), F(44), F(44)), B(36, { c: 'dark', t: 'verify' }), B(30, { c: 'line', t: 'resend in 30 s', n: 2 }), B(44, { c: 'line', t: 'wrong / expired code message', n: 3 })],
      n: ['Six boxes. Android fills the code in from the SMS.', 'Resend unlocks after 30 s. A changed number goes back one step.', 'Says whether the code was wrong or expired, and keeps what was typed.'] },
    { t: '15 Create account + consent', p: [B(26, { t: 'create your account' }), B(30, { t: 'full name', n: 1 }), R(F(56, { t: 'grower', n: 2 }), F(56, { t: 'agent' }), F(56, { t: 'driver' })), B(30, { t: 'truck no. (drivers)', n: 3 }), B(30, { t: "agent's phone (drivers)" }), B(64, { c: 'line', t: 'location · alerts switches · what we keep', n: 4 }), B(36, { c: 'dark', t: 'create account' })],
      n: ['Only what we need: name and role.', 'Role as three big cards. Police accounts are added by an admin, not here.', "Drivers add a truck number and their agent's phone; the agent confirms them, which makes them a verified driver.", 'Plain-language consent: one switch for location, one for alerts, and a note on what we keep (DPDP Act 2023). The app works without location; the user picks a zone instead.'] },
    { t: '16 Profile and settings', p: [top(), B(50, { t: 'name · role · verified badge', n: 1 }), B(40, { t: 'alert zones', n: 2 }), B(30, { t: 'offline data · 0.8 kb' }), B(32, { c: 'line', t: 'sign out', n: 3 }), B(32, { c: 'line', t: 'delete account' }), nav],
      n: ['Who is signed in, their role and whether they are verified.', 'Choose which zones send alerts.', 'Sign out keeps unsent reports until they go; delete account asks once more and explains what is erased.'] },
    { t: '17 Alerts inbox', p: [top(), B(10, { c: 'txt', s: 'width:60%' }), B(54, { t: 'police update', n: 1 }), B(54, { t: 'verified report' }), B(54, { t: 'zone turns high', n: 2 }), B(54, { t: 'scores are old' }), nav],
      n: ['Newest first. Each alert says what, where and when, in the colour of its source: police blue, verified green, high-risk red.', 'Tap an alert to open that zone. With no alerts it names the zones it watches and offers to change them.'] },
    { t: '18 Truck detail (sheet)', p: [top(), B(80, { t: 'board, dimmed' }), B(280, { c: 'line', t: 'bottom sheet', n: 1, s: 'margin-top:auto;display:flex' }), nav],
      n: ['Opens from a truck on the board: the advice and why, last seen, ETA, delay, priority, the zones on its route, and a button to call the driver.'] },
    { t: '19 Confirm dialog', p: [top(), B(120, { t: 'screen behind, dimmed' }), B(150, { c: 'line', t: 'confirm dialog', n: 1, s: 'margin:auto 8px' }), nav],
      n: ['Only for what is hard to undo: sign out with reports still waiting, delete account, and a police closure. It says what will happen (how many drivers get the alert), the main action first and Cancel under it.'] },
    { t: '20 Desktop control room (1440 × 900)', desk: true, p: [B(24, { c: 'dark', t: 'header · role · sync banner' }), R(B(200, { t: 'risk map', n: 1, s: 'flex:1' }), B(200, { t: 'strip + board', n: 2, s: 'flex:1.2' }), B(200, { t: 'reports / tcu', n: 3, s: 'flex:1' }))],
      n: ['Map with the horizon chips, as on the phone.', 'The 48-hour strip above the full shipment board, with last seen for each truck.', 'Agents see road reports and the zone most at risk. Police see the advisory form and the reports waiting for them.'] },
  ];
  if ($('#wireframes')) $('#wireframes').innerHTML = WF.map(w => `<figure class="wf" style="margin:0"><figcaption><strong>${esc(w.t)}</strong></figcaption>
    <div class="wf-frame${w.desk ? ' desk' : ''}" role="img" aria-label="Wireframe: ${esc(w.t)}">${w.p.join('')}</div><ol class="wf-notes">${w.n.map(x => `<li>${esc(x)}</li>`).join('')}</ol></figure>`).join('');

