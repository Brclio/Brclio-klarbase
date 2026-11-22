// The isle builder. Paint on a 2D grid, see the living isle update in 3D, and
// get an instant verdict from the solver. The "Isle code" box is the exact
// text format a person, a builder bot, or a GitHub PR uses — edit either side.
import {
  parseIsle, solveIsle, initialState, THEMES as THEME_NAMES, MAX_W, MAX_H, MAX_LEVEL,
  CURATED_ISLES, toCommunityFile, checkCommunityIsle, isleHash, ISLE_SCHEMA, MAP_SCHEMA, MAX_STOREYS, MAX_AT, MAX_ALT, TILES,
  TIERS, auditIsle, difficultyScore, provisionalTier, harderHints, gutMismatch,
} from '@klar/core';
import { themeOf, PORTAL_COLORS } from './game/themes.js';
import { sfx } from './game/audio.js';
import { track } from './analytics.js';   // hook(analytics)
import { guideFor } from './buildguide.js';
import { getLanguage, t, onLanguageChange } from './i18n.js';
import { gameText, isleName } from './i18n/game.js';
import { panelLabels, builderMessage } from './i18n/builder.js';
import { propThumb, thumbKind } from './game/thumbs.js';
import { BRCLIO_DEPLOYMENT, GITHUB_DEPLOYMENT, STATIC_DEPLOYMENT } from './deployment.js';
import { signInProviders } from './auth.js';

export const TOOLS = [
  ['.', '▢', 'Ground'], [',', '🌼', 'Flowers'], ['#', '🪨', 'Rock'], ['T', '🌳', 'Tree'], ['~', '🌊', 'Water'], ['*', '🧊', 'Ice'],
  ['ramp', '⬆', 'Ramp'], ['C', '📦', 'Crate'], ['o', '◎', 'Plate'], ['D', '▥', 'Gate'], ['L', '🕹', 'Lever'], ['=', '═', 'Bridge'],
  ['_', '┄', 'Sunk br.'], ['k', '🔑', 'Key'], ['K', '🚪', 'Door'], ['p', '⛩', 'Arch A'], ['q', '⛩', 'Arch B'], ['S', '🐣', 'Start'],
  ['G', '⭐', 'Goal'], ['-', '✕', 'Erase'], ['^+', '▲', 'Raise'], ['^h', '▼', 'Lower'],
  ['a', '⚖', 'Pan A'], ['b', '⚖', 'Pan B'], ['r', '⛩', 'Arch C'],     // maps only (schemaVersion 6)
  ['B', '🎈', 'Balloon'], ['P', '🥌', 'Stones'], ['u', '🛟', 'Buoy'], ['vent', '⇑', 'Vent'], ['+', '🌱', 'Seed'],   // Weight II (maps only)
  ['H', '🪨', 'Boulder ↔'], ['I', '🪨', 'Boulder ↕'], ['Y', '🌵', 'Thorns'],   // cozy hazards (maps only)
];
const RAMP_DIRS = ['^', '>', 'v', '<'], RAMP_ARROW = { '^':'⬆', '>':'➡', 'v':'⬇', '<':'⬅' };
const VENT_DIRS = ['n', 'e', 's', 'w'], VENT_ARROW = { n:'⇑', e:'⇒', s:'⇓', w:'⇐' };
const GLYPH = { ',':'🌼', '#':'🪨', 'T':'🌳', 'C':'📦', 'o':'◎', 'D':'▥', 'L':'🕹', '=':'═', '_':'┄', 'k':'🔑', 'K':'🚪', 'p':'⛩', 'q':'⛩', 'r':'⛩', 'S':'🐣', 'G':'⭐', '*':'', 'a':'A', 'b':'B', 'B':'🎈', 'P':'🥌', 'u':'🛟', '+':'🌱', 'H':'↔', 'I':'↕', 'Y':'🌵' };
// grid tiles drawn as the theme's own prop (others keep their glyph: arrows and letters carry meaning)
const GRID_THUMB = new Set(['T', '#', ',', 'C', 'P', 'Y', 'B', 'u', '+']);
const store = { get:(k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set:(k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };

const template = () => ({ name:t('My isle', '我的浮岛'), theme:'jungle', rows:[
  '-  .  .  G  .  .  -', '.  .  .  .  .  .  .', '.  .  ,  .  T  .  .', '.  .  .  .  .  .  .',
  '.  T  .  .  .  ,  .', '.  .  .  .  .  .  .', '-  .  .  S  .  .  -' ] });

// "Propose on GitHub" prefills the isle into a URL. Real isles land ~2k chars, a
// maxed 3-storey map ~6k; GitHub refuses request lines near 8 KB, so past this
// the file downloads instead.
const MAX_GITHUB_URL = 7500;

export function mountBuilder({ world, onTest, api, getSession, toast, repoUrl, communityHashes, canSeeSolutions = () => false, openGuide }){
  const root = document.getElementById('builderPanel');
  let draft = store.get('klarbase.v2.draft', null) || template();
  let grid = [], tool = '.', rampDir = 0, ventDir = 0, painting = false, stroke = new Set(), last = null, verdict = null;
  const fromRows = rows => rows.map(r => r.trim().split(/\s+/).map(t => [t[0], t.length > 1 ? +t[1] : 0]));
  const toRows = (g = grid) => g.map(r => r.map(([c, h]) => (h ? c + h : c).padEnd(2)).join(' ').trimEnd());
  // Archipelago maps (K4): the draft holds 1–3 storeys; `grid` is the one being painted.
  let storeys = [], cur = 0;
  const loadDraft = d => { storeys = (d.storeys || [{ rows:d.rows, at:[0, 0, 0] }]).map(s => ({ grid:fromRows(s.rows), at:s.at.slice() })); cur = 0; grid = storeys[0].grid; };
  // The isle document: a plain v5 isle unless it needs a map (several storeys, an offset, pans or arch C).
  const docOf = () => {
    const st = storeys.map(s => ({ rows:toRows(s.grid), at:s.at.slice() }));
    const map = st.length > 1 || st[0].at.some(Boolean) || storeys.some(s => s.grid.some(r => r.some(([c]) => TILES[c] && TILES[c].v6)));
    const tier = draft.tier ? { tier:draft.tier } : {};      // the maker's gut call — presentation, never hashed
    return map ? { schemaVersion:MAP_SCHEMA, name:draft.name, theme:draft.theme, storeys:st, ...tier } : { schemaVersion:ISLE_SCHEMA, name:draft.name, theme:draft.theme, rows:st[0].rows, ...tier };
  };
  loadDraft(draft);

  root.innerHTML = `
    <button class="btn small ghost" id="bGuide" title="Every tile, its rules and how to use it">📖 How to build</button>
    <div class="field"><label>Name</label><input id="bName" maxlength="40"></div>
    <div class="field"><label>Theme</label><div class="chips" id="bThemes"></div><div class="biome" id="bBiome"></div></div>
    <div class="field"><label>Difficulty — your gut call</label><div class="chips" id="bTiers"></div></div>
    <div class="field"><label>Start from</label><select id="bTemplate"><option value="">— keep my isle —</option><option value="blank">Fresh 7×7 meadow</option>
      ${CURATED_ISLES.map(i => `<option value="${i.id}">Remix: ${i.name}</option>`).join('')}</select></div>
    <div class="size"><span>Size</span>
      <button data-size="w-">−</button><span id="bW"></span><button data-size="w+">+</button><span>×</span>
      <button data-size="h-">−</button><span id="bH"></span><button data-size="h+">+</button>
      <span class="erase-note" style="margin-left:auto;color:var(--ink-3);font-size:12px">right-click erases</span></div>
    <div class="field"><label>Map — up to ${MAX_STOREYS} isles, linked by gateway arches</label><div class="chips" id="bStoreys"></div>
      <div class="size" id="bAt" style="margin-top:6px"><span>at</span>
        <label>x <input type="number" min="0" max="${MAX_AT}" data-at="0" style="width:52px"></label><label>z <input type="number" min="0" max="${MAX_AT}" data-at="1" style="width:52px"></label>
        <label>altitude <input type="number" min="0" max="${MAX_ALT}" data-at="2" style="width:52px"></label></div>
      <div class="note" id="bGates" style="display:none;margin-top:6px"></div></div>
    <div class="palette" id="bTools"></div>
    <canvas id="gridCanvas"></canvas>
    <div class="status" id="bStatus">…</div>
    <div class="diff" id="bDiff" style="display:none"></div>
    <div class="row-btns">
      <button class="btn primary" id="bTest">▶ Test it</button>
      <button class="btn" id="bCheck">✓ Deep check</button>
      ${STATIC_DEPLOYMENT ? '' : '<button class="btn" id="bShare">☁ Share online</button>'}
    </div>
    <div class="field"><label>Isle code — the text format (edit me too)</label><textarea id="bCode" spellcheck="false"></textarea></div>
    <div class="field"><label>${BRCLIO_DEPLOYMENT ? 'Contribute on GitHub' : 'Contribute to the official repo'}</label>
      <input id="bAuthor" placeholder="your GitHub username">
      <div class="row-btns" style="margin-top:6px">
        <button class="btn small" id="bGithub">⇪ Propose on GitHub</button>
        <button class="btn small ghost" id="bExport">⤓ JSON</button>
        <button class="btn small ghost" id="bImport">⤒ Import</button>
      </div>
      <div class="note" id="bGithubNote" style="display:none"></div>
    </div>
    <input type="file" id="bFile" accept="application/json,.json" hidden>`;
  const $ = s => root.querySelector(s);
  // Capture only the panel template's own captions, before inserting any player content.
  // On a language change update those text nodes in place, keeping canvas, selections and inputs.
  const captions = [];
  for(const el of root.querySelectorAll('label, button, span, option')){
    if(el.firstChild?.nodeType !== Node.TEXT_NODE) continue;
    const node = el.firstChild, english = node.nodeValue;
    if(Object.hasOwn(panelLabels, english)) captions.push(() => { node.nodeValue = t(english, panelLabels[english]); });
  }
  const storeyLabel = $('#bStoreys').previousElementSibling;
  const mapEnglish = storeyLabel.textContent;
  captions.push(() => {
    storeyLabel.textContent = t(mapEnglish, `群岛地图 · 最多 ${MAX_STOREYS} 座浮岛，以拱门相连`);
    $('#bGuide').title = t('Every tile, its rules and how to use it', '认识每种地块，查看规则与设计示例');
    $('#bAuthor').placeholder = t('your GitHub username', '你的 GitHub 用户名');
    for(const [i, isle] of CURATED_ISLES.entries()){
      $('#bTemplate').options[i + 2].textContent = t(`Remix: ${isle.name}`, `改编 · ${isleName(isle)}`);
    }
  });
  const canvas = $('#gridCanvas'), g2 = canvas.getContext('2d');
  $('#bAuthor').value = store.get('klarbase.v2.ghuser', '');

  // ---- palette & theme chips ----
  const tools = $('#bTools');
  for(const [id, ico, label] of TOOLS){
    const b = document.createElement('button'); b.className = 'tool'; b.dataset.tool = id;
    b.innerHTML = `<span class="ico">${ico}</span><small>${label}</small>`; b.dataset.ico = ico;
    captions.push(() => {
      const name = gameText(label), summary = guideFor(id)?.summary;
      b.querySelector('small').textContent = name; b.setAttribute('aria-label', name);
      b.title = name + (summary ? ' · ' + summary : '') + (id === 'ramp' ? t(' (click again or press R to turn)', '（再点一次或按 R 转向）') : id === 'vent' ? t(' (click again to turn the gust)', '（再点一次调整风向）') : '');
    });
    b.onclick = () => { if(id === 'ramp' && tool === 'ramp') rampDir = (rampDir + 1) % 4; if(id === 'vent' && tool === 'vent') ventDir = (ventDir + 1) % 4; tool = id; syncTools(); sfx.ui(); };
    tools.appendChild(b);
  }
  if(import.meta.env.DEV) for(const [id, , label] of TOOLS) if(!guideFor(id)) console.warn(`[klarbase] "${label}" has no How to build entry (buildguide.js)`);
  $('#bGuide').onclick = () => openGuide && openGuide();
  const syncTools = () => {
    for(const b of tools.children){ b.classList.toggle('on', b.dataset.tool === tool); if(b.dataset.tool === 'ramp') b.firstChild.textContent = RAMP_ARROW[RAMP_DIRS[rampDir]]; if(b.dataset.tool === 'vent') b.firstChild.textContent = VENT_ARROW[VENT_DIRS[ventDir]]; }
  };
  const themes = $('#bThemes');
  // each chip is a tiny isle: its sky over its ground and strata
  for(const t of THEME_NAMES){
    const T = themeOf(t), c = document.createElement('button'); c.className = 'chip theme'; c.dataset.theme = t; c.title = T.blurb;
    c.innerHTML = `<i class="sw" style="background:linear-gradient(${T.sky[0]}, ${T.sky[1]} 42%, ${T.sky[2]} 58%, ${T.top} 58%, ${T.top} 76%, ${T.strata[0]} 76%)"></i>${T.label}`;
    const themeLabel = c.lastChild;
    captions.push(() => { c.title = T.blurb; themeLabel.nodeValue = T.label; });
    c.onclick = () => { draft.theme = t; changed(); }; themes.appendChild(c);
  }

  // ---- biome thumbnails: tiles whose look follows the theme (thumbs.js) ----
  // Rendered lazily for the theme on show, cached per theme; never while painting.
  const thumbs = new Map();                  // tool id -> { url, canvas } for the current theme
  let thumbTheme = null, thumbT = 0, thumbQ = [];
  const BIOME = [['T', 'Tree'], ['#', 'Rock'], [',', 'Flowers']];
  function refreshThumbs(){
    const T = themeOf(draft.theme);
    if(thumbTheme !== T.id){ thumbTheme = T.id; thumbs.clear(); thumbQ = world.renderer ? TOOLS.map(([id]) => id).filter(thumbKind) : []; }
    // a few per tick (~8 ms), so switching theme never stalls a frame for long
    for(const t0 = performance.now(); thumbQ.length && performance.now() - t0 < 8;){
      const id = thumbQ.shift(), th = propThumb(world.renderer, T, thumbKind(id)); if(th) thumbs.set(id, th);
    }
    if(thumbQ.length) thumbT = setTimeout(refreshThumbs, 16);
    for(const b of tools.children){
      const th = thumbs.get(b.dataset.tool), ico = b.firstChild;
      ico.classList.toggle('thumb', !!th); ico.style.backgroundImage = th ? `url(${th.url})` : '';
      if(th) ico.textContent = ''; else if(!ico.textContent) ico.textContent = b.dataset.ico;
    }
    $('#bBiome').innerHTML = `<div class="biome-row">${BIOME.map(([id, name]) => thumbs.has(id) ? `<img src="${thumbs.get(id).url}" alt="${gameText(name)}" title="${t(`${name} in ${T.label}`, `${T.label}的${gameText(name)}`)}">` : '').join('')}</div><p>${esc(T.blurb)}</p>`;
    draw();
  }
  const queueThumbs = () => { clearTimeout(thumbT); thumbT = setTimeout(refreshThumbs, 30); };
  // The gut call (K3): saved in the isle file as `tier`; players' results take over as plays come in.
  const tiers = $('#bTiers');
  for(const t of [{ id:'', name:'Not sure' }, ...TIERS]){
    const c = document.createElement('button'); c.className = 'chip'; c.dataset.tier = t.id; captions.push(() => { c.textContent = t.id ? gameText(t.name) : gameText('Not sure'); });
    c.onclick = () => { if(t.id) draft.tier = t.id; else delete draft.tier; store.set('klarbase.v2.draft', draft); syncTiers(); showDifficulty(); sfx.ui(); };
    tiers.appendChild(c);
  }
  const syncTiers = () => { for(const c of tiers.children) c.classList.toggle('on', c.dataset.tier === (draft.tier || '')); };

  // ---- painting ----
  const cellAt = ev => {
    const r = canvas.getBoundingClientRect(), w = grid[0].length, h = grid.length;
    const cs = r.width / w, x = Math.floor((ev.clientX - r.left) / cs), z = Math.floor((ev.clientY - r.top) / cs);
    return x >= 0 && z >= 0 && x < w && z < h ? [x, z] : null;
  };
  const apply = ([x, z], erase) => {
    const key = x + ',' + z; if(stroke.has(key)) return; stroke.add(key);
    const cell = grid[z][x];
    if(erase || tool === '-'){ grid[z][x] = ['-', 0]; return; }
    if(tool === '^+'){ if(cell[0] !== '-') cell[1] = Math.min(MAX_LEVEL, cell[1] + 1); return; }
    if(tool === '^h'){ if(cell[0] !== '-') cell[1] = Math.max(0, cell[1] - 1); return; }
    if(tool === 'S') for(const s of storeys) for(const row of s.grid) for(const c of row) if(c[0] === 'S') c[0] = '.';
    grid[z][x] = [tool === 'ramp' ? RAMP_DIRS[rampDir] : tool === 'vent' ? VENT_DIRS[ventDir] : tool, cell[0] === '-' ? 0 : cell[1]];
  };
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => { const c = cellAt(e); if(!c) return; painting = e.button === 2 ? 'erase' : 'paint'; stroke = new Set(); canvas.setPointerCapture(e.pointerId); apply(c, painting === 'erase'); changed(); });
  canvas.addEventListener('pointermove', e => { const c = cellAt(e); last = c; if(painting && c){ apply(c, painting === 'erase'); changed(); } else draw(); });
  canvas.addEventListener('pointerup', () => { painting = false; });
  canvas.addEventListener('pointerleave', () => { last = null; draw(); });

  function draw(){
    const w = grid[0].length, h = grid.length, T = themeOf(draft.theme);
    const cssW = canvas.clientWidth || 360, cs = Math.floor(cssW / w), dpr = Math.min(devicePixelRatio, 2);
    canvas.style.height = cs * h + 'px'; canvas.width = cs * w * dpr; canvas.height = cs * h * dpr;
    g2.setTransform(dpr, 0, 0, dpr, 0, 0); g2.clearRect(0, 0, cs * w, cs * h);
    g2.textAlign = 'center'; g2.textBaseline = 'middle';
    for(let z = 0; z < h; z++) for(let x = 0; x < w; x++){
      const [c, hh] = grid[z][x], px = x * cs, pz = z * cs;
      if(c === '-'){ g2.strokeStyle = 'rgba(42,34,56,.12)'; g2.setLineDash([3, 3]); g2.strokeRect(px + 2.5, pz + 2.5, cs - 5, cs - 5); g2.setLineDash([]); continue; }
      let fill = T.top;
      const th = thumbTheme === T.id && GRID_THUMB.has(c) && thumbs.get(c);
      if(c === '~' || c === '=' || c === '_') fill = T.water; else if(c === '*') fill = T.ice; else if(c === '#' && !th) fill = T.rock;
      g2.fillStyle = fill; roundRect(g2, px + 1.5, pz + 1.5, cs - 3, cs - 3, 6); g2.fill();
      if(hh){ g2.fillStyle = `rgba(255,255,255,${0.08 * hh})`; roundRect(g2, px + 1.5, pz + 1.5, cs - 3, cs - 3, 6); g2.fill(); g2.fillStyle = 'rgba(42,34,56,.75)'; g2.font = `800 ${Math.max(9, cs * 0.28)}px Nunito`; g2.fillText(hh, px + cs - cs * 0.2, pz + cs - cs * 0.22); }
      const glyph = RAMP_ARROW[c] || VENT_ARROW[c] || GLYPH[c];
      if(th) g2.drawImage(th.canvas, px + cs * 0.06, pz + cs * 0.04, cs * 0.88, cs * 0.88);
      else if(glyph){
        g2.font = `${Math.floor(cs * 0.55)}px "Segoe UI Emoji","Apple Color Emoji",sans-serif`;
        if(c === 'p' || c === 'q' || c === 'r'){ g2.fillStyle = PORTAL_COLORS[c]; g2.beginPath(); g2.arc(px + cs / 2, pz + cs / 2, cs * 0.3, 0, Math.PI * 2); g2.fill(); g2.fillStyle = '#fff'; g2.font = `800 ${cs * 0.34}px Nunito`; g2.fillText({ p:'A', q:'B', r:'C' }[c], px + cs / 2, pz + cs / 2 + 1); }
        else if(c === 'a' || c === 'b'){ g2.fillStyle = T.woodDark; roundRect(g2, px + cs * 0.14, pz + cs * 0.14, cs * 0.72, cs * 0.72, 5); g2.fill(); g2.fillStyle = '#fff'; g2.font = `800 ${cs * 0.3}px Nunito`; g2.fillText('⚖' + glyph, px + cs / 2, pz + cs / 2 + 1); }
        else { g2.fillStyle = c === '_' ? 'rgba(255,255,255,.55)' : '#3a2a20'; g2.fillText(glyph, px + cs / 2, pz + cs / 2 + 1); }
      }
    }
    if(last){ g2.strokeStyle = '#2a2238'; g2.lineWidth = 2; roundRect(g2, last[0] * cs + 1.5, last[1] * cs + 1.5, cs - 3, cs - 3, 6); g2.stroke(); g2.lineWidth = 1; }
  }
  function roundRect(g, x, y, w, h, r){ g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  // ---- change pipeline: grid -> draft -> code/preview/verdict ----
  let previewT = 0, verdictT = 0, statusCaption = null;
  const status = (style, caption) => {
    const el = $('#bStatus'); el.className = style; statusCaption = caption; el.textContent = caption();
  };
  function changed({ fromCode = false } = {}){
    draft.name = $('#bName').value.trim() || t('My isle', '我的浮岛');
    const d = docOf(); delete draft.rows; delete draft.storeys;
    if(d.storeys) draft.storeys = d.storeys; else draft.rows = d.rows;
    store.set('klarbase.v2.draft', draft);
    syncStoreys();
    for(const c of themes.children) c.classList.toggle('on', c.dataset.theme === draft.theme); syncTiers();
    if(thumbTheme !== null && thumbTheme !== themeOf(draft.theme).id) queueThumbs();
    $('#bW').textContent = grid[0].length; $('#bH').textContent = grid.length;
    if(!fromCode && document.activeElement !== $('#bCode')) $('#bCode').value = toRows().join('\n');
    draw();
    clearTimeout(previewT); previewT = setTimeout(preview, 90);
    clearTimeout(verdictT); verdictT = setTimeout(() => judge(60000), 260);
  }
  function preview(){
    const { level } = parseIsle(docOf());
    if(!level) return;
    world.load(level, draft.theme, { storey:cur });
    if(level.start != null){ world.pip.group.visible = true; world.reset(initialState(level)); } else world.pip.group.visible = false;
  }
  function judge(budget){
    const { ok, errors, level } = parseIsle(docOf());
    if(!ok){ verdict = null; status('status bad', () => '✗ ' + [...new Set(errors.map(builderMessage))].slice(0, 2).join(' · ')); showDifficulty(); return; }
    const r = solveIsle(level, { maxStates:budget });
    verdict = r; audit = null; clearTimeout(auditT);
    if(r.solvable){ status('status ok', () => t(`✓ Solvable in ${r.par} moves`, `✓ 可解，最少 ${r.par} 步`) + (canSeeSolutions() ? ` · ${r.solution.length > 28 ? r.solution.slice(0, 28) + '…' : r.solution}` : signInProviders().length ? t(' · sign in to see the route', ' · 登录可查看路线') : ''));
      auditT = setTimeout(() => { audit = auditIsle(level, { maxStates:Math.min(budget, 200000) }); showDifficulty(); }, 60); }
    else if(r.capped){ status('status', () => t('… big isle — press “Deep check” to verify', '… 浮岛较大，请点击「深度检查」进一步验证')); }
    else { status('status bad', () => t('✗ Not solvable yet — no path reaches a goal', '✗ 暂时无解，还没有通往终点的路线')); }
    showDifficulty();
  }

  // Live difficulty (K3) + optional "make it harder" hints (K2). A catch is never required.
  let audit = null, auditT = 0;
  function showDifficulty(){
    const box = $('#bDiff');
    if(!verdict || !verdict.solvable || !audit){ box.style.display = 'none'; return; }
    box.style.display = '';
    if(audit.capped){ box.textContent = t('Difficulty: too many positions to map live — press “Deep check”.', '状态太多，无法实时估算难度。请点击「深度检查」。'); return; }
    const d = difficultyScore({ tier:draft.tier, audit }), a = provisionalTier(audit);
    const warn = gutMismatch(draft.tier, audit), hints = harderHints(audit);
    if(getLanguage() === 'zh-CN'){
      box.innerHTML = `<div><span class="tier t-${d.tier.id}">${gameText(d.tier.name)} ${d.score}</span> · ${d.declared ? '由你评定' : '求解器估计'}${BRCLIO_DEPLOYMENT ? '' : ' · 随游玩结果调整'}</div>
        <div style="font-weight:600">求解器探索了 ${audit.states.toLocaleString('zh-CN')} 个状态，找到 ${audit.traps} 处陷阱，${audit.routes > 999 ? '超过 999' : audit.routes} 条最短路线。径直走向星星${audit.greedy ? '可以' : '不能'}通关，估计难度为<b>${gameText(a.name)}</b>。</div>
        ${warn ? `<div class="warn">⚠ ${esc(builderMessage(warn))}</div>` : ''}
        ${hints.length ? `<div>想提高难度？<ul>${hints.map(h => `<li>${esc(builderMessage(h))}</li>`).join('')}</ul></div>` : ''}`;
      return;
    }
    box.innerHTML = `<div><span class="tier t-${d.tier.id}">${d.tier.name} ${d.score}</span> · ${d.declared ? 'your gut call' : 'estimated from the solver'} · settles as people play</div>
      <div style="font-weight:600">Solver audit: ${audit.states.toLocaleString()} positions · ${audit.traps} trap${audit.traps === 1 ? '' : 's'} · ${audit.routes > 999 ? 'many' : audit.routes} shortest route${audit.routes === 1 ? '' : 's'} · walking straight at the star ${audit.greedy ? 'wins' : 'fails'} → reads <b>${a.name}</b></div>
      ${warn ? `<div class="warn">⚠ ${esc(warn)}</div>` : ''}
      ${hints.length ? `<div>Make it harder (optional):<ul>${hints.map(h => `<li>${esc(h)}</li>`).join('')}</ul></div>` : ''}`;
  }

  // ---- controls ----
  $('#bName').value = draft.name;
  $('#bName').addEventListener('input', () => changed());
  root.querySelectorAll('[data-size]').forEach(b => b.onclick = () => {
    const [axis, d] = [b.dataset.size[0], b.dataset.size[1] === '+' ? 1 : -1];
    if(axis === 'w'){ const n = grid[0].length + d; if(n < 3 || n > MAX_W) return; grid.forEach(r => d > 0 ? r.push(['.', 0]) : r.pop()); }
    else { const n = grid.length + d; if(n < 3 || n > MAX_H) return; if(d > 0) grid.unshift(grid[0].map(() => ['.', 0])); else grid.shift(); }
    changed();
  });
  $('#bTemplate').onchange = e => {
    const v = e.target.value; if(!v) return;
    const src = v === 'blank' ? template() : CURATED_ISLES.find(i => i.id === v);
    draft = { name:v === 'blank' ? src.name : t(src.name + ' remix', isleName(src) + '改编版'), theme:src.theme, ...(src.storeys ? { storeys:src.storeys } : { rows:src.rows.slice() }) };
    loadDraft(draft); $('#bName').value = draft.name; e.target.value = ''; changed();
  };
  let codeT = 0;
  $('#bCode').addEventListener('input', () => {
    clearTimeout(codeT);
    codeT = setTimeout(() => {
      const rows = $('#bCode').value.split('\n').map(s => s.trim()).filter(Boolean);
      const d = docOf(); if(d.storeys) d.storeys[cur].rows = rows; else d.rows = rows;
      const r = parseIsle(d);
      if(!r.level){ status('status bad', () => '✗ ' + builderMessage(r.errors[0])); return; }
      grid = storeys[cur].grid = fromRows(rows); changed({ fromCode:true });
    }, 350);
  });
  $('#bCheck').onclick = () => { status('status', () => t('checking…', '检查中…')); setTimeout(() => judge(300000), 30); };
  $('#bTest').onclick = () => {
    const doc = docOf(), { ok, errors } = parseIsle(doc);
    if(!ok) return toast(builderMessage(errors[0]), true);
    onTest({ ...doc, par:verdict && verdict.solvable ? verdict.par : 0, solution:verdict && verdict.solvable ? verdict.solution : '' });
  };
  if(!STATIC_DEPLOYMENT) $('#bShare').onclick = async () => {
    if(GITHUB_DEPLOYMENT && !signInProviders().length) return toast(t('Sign-in is unavailable', '暂时无法登录'), true);
    if(!getSession()) return toast(t('Sign in (top right) to share online', '请先在右上角登录，再在线分享'), true);
    try {
      const r = await api('/puzzles', { method:'POST', body:{ title:draft.name, puzzle:docOf() } });
      const url = `${location.origin}/i/${r.hash}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      track('share_online');   // hook(analytics)
      toast(r.deduped ? t('Already shared — link copied', '这座浮岛已分享，链接已复制') : t('Shared! Link copied to clipboard', '分享成功，链接已复制'));
    } catch(e){ toast(builderMessage(e.validation ? e.validation[0] : e.message), true); }
  };
  let contributionCaption = null;
  $('#bGithub').onclick = () => {
    const author = $('#bAuthor').value.trim().replace(/^@/, '');
    store.set('klarbase.v2.ghuser', author);
    const note = $('#bGithubNote'); note.style.display = 'block';
    // The note sits at the panel's foot — scroll it into view or the button looks dead.
    const show = () => note.scrollIntoView({ block:'nearest' });
    const setNote = caption => { contributionCaption = caption; note.innerHTML = caption(); };
    if(!author){ setNote(() => t('Add your GitHub username — it becomes your credit on the isle.', '请先填写 GitHub 用户名，浮岛会用它为你署名。')); show(); return; }
    const file = toCommunityFile(docOf(), author);
    const existing = new Map([...CURATED_ISLES.map(i => [isleHash(i), `official isle “${i.name}”`]), ...communityHashes()]);
    const v = checkCommunityIsle(file, { existing });
    if(!v.ok){ setNote(() => t('<b>Not ready yet — the repo checks would reject it:</b><br>• ', '<b>还不能投稿，请先修改以下问题。</b><br>• ') + v.errors.map(e => esc(builderMessage(e))).join('<br>• ')); show(); return; }
    const text = JSON.stringify(file, null, 2) + '\n', path = `isles/community/${author}/${file.id}.json`;
    const passed = () => t(`✓ Passes every check (par ${file.par}, uses ${v.report.mechanics.join(', ')}).<br>`, `✓ 已通过所有检查，最少 ${file.par} 步，用到了${v.report.mechanics.map(gameText).join('、')}。<br>`);
    const how = () => `<a href="${repoUrl}/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener">${t('how to contribute', '投稿指南')}</a>`;
    // GitHub's new-file page prefills from the URL, signs the player in, forks for
    // non-collaborators and opens the PR — no OAuth on our side.
    const url = `${repoUrl}/new/main/isles/community/${author}?filename=${file.id}.json&value=${encodeURIComponent(text)}`;
    if(url.length <= MAX_GITHUB_URL){
      setNote(() => passed() + `<a class="btn small primary" style="text-decoration:none" href="${esc(url)}" target="_blank" rel="noopener">${t('⇪ Open the pull request on GitHub', '⇪ 在 GitHub 发起合并请求')}</a><br>` +
        t(`It opens <code>${esc(path)}</code> prefilled — sign in, then “Commit changes…” → “Propose changes” → “Create pull request” (${how()}).`,
          `将打开预填的 <code>${esc(path)}</code>。在 GitHub 登录后依次点击 “Commit changes…” → “Propose changes” → “Create pull request”。见${how()}。`));
      note.onclick = e => { if(e.target.closest('a.btn')) track('propose_github'); };   // hook(analytics)
      show(); return;
    }
    download(`${file.id}.json`, text); track('propose_github');   // hook(analytics)
    setNote(() => passed() + t(`Too big to prefill on GitHub, so it downloaded instead. Add it to <code>${esc(path)}</code> and open a pull request — ${how()}.`,
        `地图较大，已下载文件。请把文件添加到 <code>${esc(path)}</code>，然后发起合并请求。见${how()}。`));
    show();
  };
  $('#bExport').onclick = () => download(`${(draft.name || 'isle').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'isle'}.json`,
    JSON.stringify(docOf(), null, 2) + '\n');
  $('#bImport').onclick = () => $('#bFile').click();
  $('#bFile').onchange = e => {
    const f = e.target.files[0]; if(!f) return;
    f.text().then(t => {
      try {
        const d = JSON.parse(t); const r = parseIsle(d);
        if(!r.level) throw new Error(builderMessage(r.errors[0]));
        draft = { name:d.name || t('Imported isle', '导入的浮岛'), theme:d.theme || 'jungle', ...(d.storeys ? { storeys:d.storeys } : { rows:d.rows }), ...(TIERS.some(t => t.id === d.tier) ? { tier:d.tier } : {}) }; loadDraft(draft);
        $('#bName').value = draft.name; changed(); toast(t('Isle imported', '浮岛已导入'));
      } catch(err){ toast(t('Could not import: ' + err.message, '无法导入。' + (err instanceof SyntaxError ? '请检查 JSON 格式。' : err.message)), true); }
    });
    e.target.value = '';
  };

  function download(name, text){ const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type:'application/json' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

  // ---- storeys: tabs, add / remove, offset + altitude, gateway summary ----
  function syncStoreys(){
    const bar = $('#bStoreys');
    bar.innerHTML = storeys.map((_, k) => `<button class="chip${k === cur ? ' on' : ''}" data-storey="${k}">${t('Isle ', '浮岛 ')}${k + 1}</button>`).join('')
      + (storeys.length < MAX_STOREYS ? `<button class="chip" data-storey="add">${t('＋ Isle', '＋ 添加浮岛')}</button>` : '')
      + (storeys.length > 1 ? `<button class="chip" data-storey="del">${t('✕ Remove isle ', '✕ 移除浮岛 ')}${cur + 1}</button>` : '');
    $('#bAt').style.display = storeys.length > 1 || storeys[0].at.some(Boolean) ? '' : 'none';
    root.querySelectorAll('[data-at]').forEach(i => { if(document.activeElement !== i) i.value = storeys[cur].at[+i.dataset.at]; });
    // gateways: an arch letter whose two arches sit on different isles
    const { level } = parseIsle(docOf()), notes = [];
    if(level) for(const [u, v] of Object.entries(level.twin)) if(+u < v && level.cells[u].gateway){
      const arch = { p:'A', q:'B', r:'C' }[level.cells[u].ch], a = level.sid[u] + 1, b = level.sid[v] + 1;
      notes.push(t(`Arch ${arch} is a gateway: isle ${a} ↔ isle ${b}`, `拱门 ${arch} 连通浮岛 ${a} 与浮岛 ${b}`));
    }
    if(level?.pans){
      const a = level.sid[level.pans.a[0]] + 1, b = level.sid[level.pans.b[0]] + 1;
      notes.push(a === b ? t('Sky Scales: pans A and B share one vine', '天空天平的 A、B 秤盘由同一根藤蔓相连')
        : t(`Sky Scales across isles ${a} and ${b}`, `天空天平连接浮岛 ${a} 与浮岛 ${b}`));
    }
    $('#bGates').style.display = notes.length ? '' : 'none'; $('#bGates').textContent = notes.join(' · ');
  }
  $('#bStoreys').onclick = e => {
    const b = e.target.closest('[data-storey]'); if(!b) return;
    const v = b.dataset.storey;
    if(v === 'add'){
      const x = Math.min(MAX_AT, Math.max(...storeys.map(s => s.at[0] + s.grid[0].length)) + 1);
      storeys.push({ grid:fromRows(['. . . . .', '. . . . .', '. . . . .', '. . . . .', '. . . . .']), at:[x, 0, Math.min(MAX_ALT, 4)] });
      cur = storeys.length - 1;
    } else if(v === 'del'){ storeys.splice(cur, 1); cur = Math.max(0, cur - 1); }
    else cur = +v;
    grid = storeys[cur].grid; sfx.ui(); changed();
  };
  root.querySelectorAll('[data-at]').forEach(i => i.addEventListener('input', () => {
    const n = Math.round(+i.value), max = i.dataset.at === '2' ? MAX_ALT : MAX_AT;
    if(Number.isFinite(n)){ storeys[cur].at[+i.dataset.at] = Math.max(0, Math.min(max, n)); changed(); }
  }));

  addEventListener('keydown', e => {
    if(!root.closest('.screen').classList.contains('on') || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    if(e.key === 'r' || e.key === 'R'){ rampDir = (rampDir + 1) % 4; tool = 'ramp'; syncTools(); }
  });
  addEventListener('resize', () => draw());
  const refreshLanguage = () => {
    for(const update of captions) update();
    if(statusCaption) $('#bStatus').textContent = statusCaption();
    if(contributionCaption) $('#bGithubNote').innerHTML = contributionCaption();
    if(thumbTheme !== null) refreshThumbs();
    showDifficulty(); syncStoreys();
  };
  refreshLanguage(); onLanguageChange(refreshLanguage);
  syncTools();

  return {
    show(){ changed(); queueThumbs(); },
    get draft(){ return draft; },
  };
}
