// Klarbase — app shell. Screens: title · choose an isle · play · build.
// Isles come from three places, all played by the same engine:
//   official   — the 24 curated isles in @klar/core
//   community  — isles merged on GitHub (isles/community/<author>/<id>.json),
//                bundled at build time with credit to their author
//   online     — isles shared in-game and stored on the server (/i/<hash>)
import { CURATED_ISLES, CHAPTERS, SCHEMAS, parseIsle, solveIsle, solveSeeds, starsFor, isleHash, initialState,
  auditIsle, difficultyScore, playSummary, SUMMARY_MIN, TIER_IDS, skyOf, confluenceState, constellation, CONFLUENCE_NEED, dailyPick, dailyNumber, dailyEpoch, dailyShareText, utcDate, timeBucket } from '@klar/core';
// self-hosted fonts (OFL-1.1, bundled by Vite): visitors' browsers never contact Google Fonts
import '@fontsource/fredoka/500.css'; import '@fontsource/fredoka/600.css'; import '@fontsource/fredoka/700.css';
import '@fontsource/nunito/500.css'; import '@fontsource/nunito/600.css'; import '@fontsource/nunito/700.css'; import '@fontsource/nunito/800.css';
import { BRCLIO_DEPLOYMENT, GITHUB_DEPLOYMENT, REPO_URL, STATIC_DEPLOYMENT } from './deployment.js';
import './language-switch.js';
import { t, onLanguageChange } from './i18n.js';
import { gameText, isleName, isleHint, isleCatch } from './i18n/game.js';
import { helpText } from './i18n/main.js';
import { siteFoot } from './sitefoot.js'; // hook(repo)
import { World } from './game/world.js';
import { LOOK } from './game/look.js';                       // hook(look)
import { LABEL as Q_LABEL, ICON as Q_ICON } from './game/quality.js';   // hook(look)
import { Session } from './game/session.js';
import { THEMES, themeOf } from './game/themes.js';
import { unlockAudio, setSound, soundOn, sfx } from './game/audio.js';
import { mountBuilder, TOOLS } from './builder.js';
import { buildGuideHtml } from './buildguide.js';
import { getSession, loadAuthProviders, signInProviders, signOut } from './auth.js';
import { openSignIn, signInButtons, startSignIn } from './signin.js';    // hook(cloudsave)
import { initCloudSave, syncOnSignIn, pushSoon, flushCloudSave } from './cloudsave.js';   // hook(cloudsave)
import { readProgress, writeProgress } from './progress-storage.js';
import { openComments, commentCount } from './comments.js';   // hook(comments)
import { api } from './net.js';
import { initAnalytics, track, identify, reset as resetAnalytics } from './analytics.js';   // hook(analytics)
import { showLegal, LEGAL_PAGES } from './legal/index.js';   // hook(legal)

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const store = {
  get:(k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set:(k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

/* ---------------- isle catalogue ---------------- */
const COMMUNITY = Object.values(import.meta.glob('../../isles/community/*/*.json', { eager:true, import:'default' }))
  .filter(d => d && (Array.isArray(d.rows) || Array.isArray(d.storeys)))
  .sort((a, b) => a.name.localeCompare(b.name));
// statKey: the isle's id in the anonymous play stats (K7) — see server/src/routes/plays.js
// Main-path numbering skips side paths: Twist isles ("Twist") and Confluence isles ("✦", Phase 5)
// A chapter is keyed by its id, or by its theme for the original five (one theme each).
const chapterKey = c => c.id || c.theme, chapterOf = d => CHAPTERS.find(c => chapterKey(c) === (d.chapter || d.theme));
const offPath = d => !!(d.twist || d.joins);
const MAIN_COUNT = CURATED_ISLES.filter(d => !offPath(d)).length;
const chapterTitle = k => gameText(CHAPTERS.find(c => chapterKey(c) === k)?.title || k);
let mainNo = 0;
const official = CURATED_ISLES.map((d, i) => ({ num:offPath(d) ? null : ++mainNo, key:'o:' + d.id, statKey:d.id, doc:d, get name(){ return isleName(d); }, theme:d.theme, par:d.par, solution:d.solution,
  get hint(){ return isleHint(d); }, tier:d.tier, twist:!!d.twist, joins:d.joins || null, side:offPath(d), index:i,
  get sub(){
    const chapter = gameText(chapterOf(d)?.title || themeOf(d.theme).chapter);
    const section = d.twist ? t('Twist isle', '变奏浮岛') : d.joins ? d.joins.map(chapterTitle).join(' × ') : t(`isle ${this.num} of ${MAIN_COUNT}`, `第 ${this.num} 关，共 ${MAIN_COUNT} 关`);
    return `${chapter} · ${section}`;
  } }));
const community = COMMUNITY.map(d => ({ key:`c:${d.author}/${d.id}`, statKey:`c/${d.author}/${d.id}`, doc:d, get name(){ return isleName(d, 'community'); }, theme:d.theme, par:d.par, solution:d.solution,
  get hint(){ return isleHint(d, 'community'); }, tier:d.tier, author:d.author, get sub(){ return t(`by @${d.author}`, `作者 @${d.author}`); } }));
// Hand-made dated Daily Isles: isles/daily/YYYY-MM-DD.json (checked by tools/check-isles.mjs)
const DATED = Object.entries(import.meta.glob('../../isles/daily/*.json', { eager:true, import:'default' }))
  .map(([p, d]) => ({ date:p.slice(-15, -5), d })).filter(({ date, d }) => d && (Array.isArray(d.rows) || Array.isArray(d.storeys)) && d.id === 'daily-' + date)
  .map(({ date, d }) => ({ key:'d:' + date, statKey:'d/' + date, date, doc:d, get name(){ return isleName(d, 'daily'); }, theme:d.theme, par:d.par, solution:d.solution,
    get hint(){ return isleHint(d, 'daily'); }, tier:d.tier, get catch(){ return isleCatch(d, 'daily'); }, author:d.author || null, get sub(){ return d.author ? t(`by @${d.author}`, `作者 @${d.author}`) : t('today’s hand-made isle', '今日手工浮岛'); } }));
// Past hand-made dailies stay playable from the Community tab (newest first), never before their day.
const pastDailies = () => DATED.filter(e => e.date < utcDate()).sort((a, b) => b.date.localeCompare(a.date));
const communityHashes = () => COMMUNITY.map(d => [isleHash(d), t(`community isle “${d.name}” by @${d.author}`, `@${d.author} 的社区浮岛《${isleName(d, 'community')}》`)]);

/* ---------------- difficulty (K3) + anonymous play stats (K7) ---------------- */
// Every card shows a tier and a 0–100 score: the maker's gut call (or the solver
// audit) first, real players' results taking over as plays accumulate. The math
// is difficultyScore() in @klar/core; this file only gathers its inputs.
let plays = {}, playsAt = 0, playsLoaded = false;
async function loadPlays(){
  if(BRCLIO_DEPLOYMENT || Date.now() - playsAt < 60000) return;
  playsAt = Date.now();
  try { plays = (await api('/plays')).plays || {}; playsLoaded = true; } catch { return; }
  document.querySelectorAll('[data-stats]').forEach(el => { const e = entryByKey(el.dataset.stats); if(e) el.textContent = statsLine(e); });
  document.querySelectorAll('[data-score]').forEach(el => { const e = entryByKey(el.dataset.score); if(e) el.outerHTML = tierBadge(e); });
}
const auditCache = new Map();
function scoreOf(e){
  let audit = e.audit || null;
  if(!e.tier && !audit && e.doc && (Array.isArray(e.doc.rows) || Array.isArray(e.doc.storeys))){      // undeclared tier → provisional prior from the audit
    const k = e.doc.theme + JSON.stringify(e.doc.storeys || e.doc.rows);
    if(!auditCache.has(k)){ const { level } = parseIsle(e.doc); auditCache.set(k, level ? auditIsle(level) : null); }
    audit = auditCache.get(k);
  }
  const st = e.statKey && plays[e.statKey];
  return difficultyScore({ tier:e.tier, audit, stats:st ? { ...st, par:e.par } : null });
}
function tierBadge(e){
  const d = scoreOf(e);
  // Every new isle is under 20 plays, so an on-card "settling" read as noise on every card — the tooltip says it.
  const prior = d.declared ? t('the maker’s rating', '作者评级') : t('the solver’s estimate', '求解器估算');
  const why = BRCLIO_DEPLOYMENT ? t(`from ${prior}`, `依据${prior}`) : d.settling
    ? t(`early estimate — ${d.n} of 20 plays so far; starts from ${prior}`, `初步评级来自${prior}，已记录 ${d.n}/20 次游玩`)
    : t(`from ${d.n} plays`, `依据 ${d.n} 次游玩`);
  return `<span class="tier t-${d.tier.id}" data-score="${esc(e.key)}" title="${t('Difficulty', '难度')} ${d.score}/100 · ${why}">${gameText(d.tier.name)} ${d.score}</span>`;
}
// Card line: "▶ 128 plays · 64% clear · 9% at par" — counts only, from the same anonymous sums.
function statsLine(e){
  if(!playsLoaded || !e.statKey) return '';
  const s = playSummary(plays[e.statKey], e.par);
  if(!s.plays) return t('✦ new — no plays yet', '✦ 新浮岛，尚无人挑战');
  return [t(`▶ ${s.plays} play${s.plays > 1 ? 's' : ''}`, `▶ ${s.plays} 次游玩`), s.clearRate != null && t(`${s.clearRate}% clear`, `通关率 ${s.clearRate}%`), s.parRate != null && t(`${s.parRate}% at par`, `最少步数通关率 ${s.parRate}%`)].filter(Boolean).join(' · ');
}
// Win screen: how this isle has gone for everyone, and where your clear lands.
function crowdLine(e, moves){
  const s = e.statKey && playSummary(plays[e.statKey], e.par);
  if(!s || s.plays < SUMMARY_MIN.clearRate) return '';
  const rare = e.par && moves <= e.par && s.parRate != null && s.parRate <= 50 ? t(` — you're among the ${Math.max(1, s.parRate)}% who hit par`, `，你是以最少步数通关的 ${Math.max(1, s.parRate)}% 玩家之一`) : '';
  return `<div class="crowd">${t(`Played ${s.plays} times · ${s.clearRate}% clear it`, `共挑战 ${s.plays} 次 · 通关率 ${s.clearRate}%`)}${s.parRate != null ? t(` · ${s.parRate}% at par`, ` · 最少步数通关率 ${s.parRate}%`) : ''}${rare}</div>`;
}
const entryByKey = k => [...official, ...community, ...DATED, ...(online || [])].find(e => e.key === k) || (current && current.key === k ? current : null);
// Fire-and-forget; counts only — no id, no cookie (credentials omitted).
function postPlay(event, extra = {}){
  if(BRCLIO_DEPLOYMENT || !current || current.draft || !current.statKey) return;
  trackPlay(event, extra);   // hook(analytics)
  fetch('/api/plays', { method:'POST', headers:{ 'content-type':'application/json' }, credentials:'omit', keepalive:true,
    body:JSON.stringify({ key:current.statKey, event, ...extra }) }).catch(() => {});
}
// hook(analytics): the same four moments as the anonymous play totals; source from the isle's stat key
function trackPlay(event, extra){
  const k = current.statKey, source = k.startsWith('c/') ? 'community' : k.startsWith('d/') ? 'daily' : k.startsWith('i/') ? 'online' : k.startsWith('w/') ? 'wild' : 'official';
  if(event === 'start') track('isle_start', { source, par:current.par });
  else if(event === 'clear') track('isle_clear', { source, par:current.par, moves:extra.moves, ms_bucket:timeBucket(extra.ms) });
  else track(event);
}
let attemptOpen = false;   // a "start" is the first move of a visit, or the first move after a clear

/* ---------------- Daily Isle ---------------- */
// Today's hand-made file wins; otherwise a deterministic pick (same for everyone)
// from Twist isles, Tricky+ official isles and community isles.
const DAILY_EPOCH_DATE = dailyEpoch(DATED.map(e => e.date));
const atLeastTricky = e => TIER_IDS.indexOf(e.tier) >= TIER_IDS.indexOf('tricky');
function dailyEntry(date = utcDate()){
  const no = dailyNumber(date, DAILY_EPOCH_DATE);
  let e = DATED.find(x => x.date === date);
  if(!e){
    const pool = [...official.filter(x => x.twist || atLeastTricky(x)), ...community];
    const key = dailyPick(pool.map(x => x.key), date);
    e = pool.find(x => x.key === key);
  }
  return e && {
    ...e, daily:{ no, date },
    get name(){ return e.name; },
    get hint(){ return e.hint; },
    get catch(){ return e.catch; },
    get sub(){ return t(`Daily Isle #${no} · ${e.sub}`, `每日浮岛 第 ${no} 期 · ${e.sub}`); },
  };
}

/* ---------------- app state ---------------- */
const world = new World($('#stage'));
if(import.meta.env.DEV) window.__klar = { world, look:LOOK, quality:world.quality, get post(){ return world.post; } };   // dev-only handle for art/perf checks (draw calls, screenshots, live look tuning) — hook(look)
const settings = store.get('klarbase.v2.settings', { sound:true, timer:false });
const progress = readProgress('progress', {});
let session = null, game = null, current = null, tab = 'official', online = null;
let mapCtl = null, mapToken = 0;   // Sky Atlas (client/src/map, loaded on demand)

/* ---------------- Your Sky (Phase 5) ---------------- */
// Every chapter is a constellation (skyOf in @klar/core). Clear CONFLUENCE_NEED of its
// main isles and it's lit; light both of a Confluence isle's chapters and it opens in
// the picker (a link to it always plays). Daily clears add stars of their own — a
// missed day costs nothing, there is no streak to break.
const dailies = readProgress('dailies', {});   // { 'YYYY-MM-DD': stars }
const mySky = () => skyOf(CHAPTERS, CURATED_ISLES, Object.fromEntries(official.map(e => [e.doc.id, progress[e.key]?.stars || 0])));
function lockOf(e, sky = mySky()){
  const st = confluenceState(e.doc, sky);
  return st.open ? null : t('Light ', '点亮：') + st.need.map(n => `${gameText(n.title)} ${Math.min(n.cleared, n.need)}/${n.need}`).join(' · ');
}
function skySvg(sky, big){
  const cols = big ? Math.min(2, sky.length) : sky.length, cw = big ? 150 : 64, ch = big ? 64 : 44, lh = big ? 16 : 0, pad = 7;
  const W = cols * cw, H = Math.ceil(sky.length / cols) * (ch + lh), lit = sky.filter(c => c.lit).length;
  const body = sky.map((c, k) => {
    const ox = (k % cols) * cw, oy = Math.floor(k / cols) * (ch + lh), acc = themeOf(c.theme).accent;
    const pts = constellation(c.key, c.points.length).map(([x, y]) => [ox + pad + x * (cw - 2 * pad), oy + pad + y * (ch - 2 * pad)]);
    const lines = pts.slice(1).map(([x, y], i) => c.points[i].stars && c.points[i + 1].stars
      ? `<line x1="${pts[i][0].toFixed(1)}" y1="${pts[i][1].toFixed(1)}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${c.lit ? acc : '#fff'}" stroke-opacity="${c.lit ? 0.9 : 0.35}" stroke-width="${big ? 1.4 : 1}"/>` : '').join('');
    const dots = pts.map(([x, y], i) => { const n = c.points[i].stars;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(n ? (big ? 2 : 1.5) + n * (big ? 1 : 0.7) : (big ? 1.4 : 1.2)).toFixed(1)}" fill="${n && c.lit ? acc : '#fff'}" fill-opacity="${n ? 1 : 0.3}"${n === 3 ? ' class="tw"' : ''}/>`; }).join('');
    const label = big ? `<text x="${ox + cw / 2}" y="${oy + ch + 10}" text-anchor="middle" class="sky-lbl">${esc(gameText(c.title))} ${c.lit ? '✦' : `${Math.min(c.cleared, CONFLUENCE_NEED)}/${CONFLUENCE_NEED}`}</text>` : '';
    return lines + dots + label;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${t(`Your sky: ${lit} of ${sky.length} constellations lit`, `我的星空：已点亮 ${lit}/${sky.length} 个星座`)}">${body}</svg>`;
}
// Daily stars: a sunflower spiral, one star per Daily Isle you've cleared.
function dailySvg(days){
  if(!days.length) return `<div class="sky-empty">${t('Clear a Daily Isle to place your first star here.', '完成一次每日浮岛挑战，在这里点亮第一颗星。')}</div>`;
  const R = 6 * Math.sqrt(days.length) + 8;
  const dots = days.map((d, i) => { const a = i * 2.39996, r = 6 * Math.sqrt(i + 0.5);
    const date = d.replace(/^(\d{4})-(\d{2})-(\d{2})$/, (_, y, m, day) => `${y}年${Number(m)}月${Number(day)}日`);
    return `<circle cx="${(R + r * Math.cos(a)).toFixed(1)}" cy="${(R + r * Math.sin(a)).toFixed(1)}" r="${(1.2 + (dailies[d] || 1) * 0.7).toFixed(1)}" fill="#ffe7a3"><title>${esc(t(d, date))} ${'★'.repeat(dailies[d] || 1)}</title></circle>`; }).join('');
  return `<svg viewBox="0 0 ${(2 * R).toFixed(1)} ${(2 * R).toFixed(1)}" style="width:${Math.min(220, Math.round(8 * R))}px">${dots}</svg>`;
}
function renderSkyStrip(){
  const sky = mySky(), got = sky.reduce((s, c) => s + c.stars, 0), max = sky.reduce((s, c) => s + c.max, 0);
  $('#skyStrip').innerHTML = `${skySvg(sky, false)}<span>${t(`Your sky · ${got} / ${max} ★ · ${sky.filter(c => c.lit).length} lit`, `我的星空 · ${got} / ${max} ★ · 已点亮 ${sky.filter(c => c.lit).length} 个星座`)}</span>`;
}
function openSky(){
  const sky = mySky(), days = Object.keys(dailies).sort();
  const conf = official.filter(e => e.joins);
  modal.open(`<h2>${t("Your sky", "我的星空")}</h2>
    <div class="sky-big">${skySvg(sky, true)}</div>
    <p class="note" style="margin-top:10px">${t(`Clear ${CONFLUENCE_NEED} isles of a chapter to light its constellation. Light two, and the Confluence isle where they meet opens.`, `每章通关 ${CONFLUENCE_NEED} 座主线浮岛，就能点亮对应的星座。点亮一对星座，即可开启连接它们的交汇浮岛。`)}</p>
    ${conf.length ? `<div class="conf-list">${conf.map(e => { const l = lockOf(e, sky);
      return `<div class="conf"><b>${esc(e.name)}</b><span>${esc(e.sub)}</span>${l ? `<em>🔒 ${esc(l)}</em>` : `<button class="btn small primary" data-sky="${esc(e.doc.id)}">${t("Play ▶", "挑战 ▶")}</button>`}</div>`; }).join('')}</div>` : ''}
    <div class="hist-cap">${t(`Daily stars · ${days.length} day${days.length === 1 ? '' : 's'}`, `每日星辰 · 已挑战 ${days.length} 天`)}</div>
    <div class="sky-big">${dailySvg(days)}</div>
    <div class="row"><button class="btn" id="skyClose">${t("Close", "关闭")}</button></div>`);
  $('#skyClose').onclick = () => modal.close();
  document.querySelectorAll('[data-sky]').forEach(b => b.onclick = () => { modal.close(); nav('/isle/' + b.dataset.sky); });
}
$('#skyStrip').onclick = () => { sfx.ui(); openSky(); };
// A clear that lights a constellation (and maybe opens a Confluence isle) says so.
function skyNews(before, after){
  const lit = after.filter((c, k) => c.lit && !before[k].lit);
  if(!lit.length) return { html:'', open:null };
  const opened = official.filter(x => x.joins && confluenceState(x.doc, after).open && !confluenceState(x.doc, before).open);
  return { open:opened[0] || null, html:`<div class="sky-news">✦ ${lit.map(c => t(`The ${esc(gameText(c.title))} constellation is lit`, `已点亮「${esc(gameText(c.title))}」星座`)).join(' · ')}${opened.length
    ? ` — ${t(`${opened.length > 1 ? `${opened.length} Confluence isles have` : 'a Confluence isle has'} opened:`, `已解锁 ${opened.length} 座交汇浮岛：`)} <b>${opened.map(x => esc(x.name)).join(', ')}</b>` : ''}</div>` };
}
setSound(settings.sound);

function toast(msg, bad = false){
  const element = $('#toast'); element.textContent = msg; element.className = 'glass on' + (bad ? ' bad' : '');
  clearTimeout(toast.t); toast.t = setTimeout(() => element.className = 'glass', 2600);
}
function setAccent(theme){
  const T = themeOf(theme);
  document.documentElement.style.setProperty('--accent', T.accent);
}
function show(id){ document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === 'scr-' + id)); document.body.classList.toggle('in-game', id === 'game'); document.body.classList.toggle('in-map', id === 'map'); syncInset(); }
// Phone builder: the panel is a bottom sheet — keep the isle framed in the space above it.
const sheet = document.querySelector('#scr-create .side');
function syncInset(){
  const on = document.getElementById('scr-create').classList.contains('on') && innerWidth <= 760;
  world.setInsetBottom(on ? innerHeight - sheet.getBoundingClientRect().top : 0);
}
new ResizeObserver(syncInset).observe(sheet);
const modal = { open(html, wide = false){ $('#modalBody').innerHTML = html; $('#modalBody').classList.toggle('wide', wide); $('#modal').classList.add('on'); }, close(){ $('#modal').classList.remove('on'); } };
$('#modal').addEventListener('click', e => { if(e.target.id === 'modal') modal.close(); });

/* ---------------- top bar ---------------- */
function syncTopbar(){
  $('#btnSound').textContent = settings.sound ? '🔊' : '🔈';
  const qt = world.quality.tier; $('#btnQuality').textContent = Q_ICON[qt]; $('#btnQuality').title = t(`Graphics: ${Q_LABEL[qt]} — click to change`, `画质：${Q_LABEL[qt]}，点击切换`);   // hook(look)
  $('#btnTimer').style.opacity = settings.timer ? 1 : 0.5;
  $('#btnTimer').title = settings.timer ? t("Timer on — click to turn off", "计时已开启，点击关闭") : t("Time my attempts", "开启计时");
  $('#statTimeWrap').style.display = settings.timer ? '' : 'none';
}
$('#btnSound').onclick = () => { settings.sound = !settings.sound; setSound(settings.sound); store.set('klarbase.v2.settings', settings); syncTopbar(); };
$('#btnQuality').onclick = () => { const tier = world.quality.cycle(); syncTopbar(); toast(t(`Graphics: ${Q_LABEL[tier]}${tier === 'fast' ? ' — no post effects' : ''}`, `画质：${Q_LABEL[tier]}${tier === 'fast' ? '（关闭后期效果）' : ''}`)); };   // hook(look)
world.quality.onChange = syncTopbar;      // the frame-time monitor may drop a tier on its own — hook(look)
$('#btnTimer').onclick = () => { settings.timer = !settings.timer; store.set('klarbase.v2.settings', settings); syncTopbar(); toast(settings.timer ? t("Timer on — your times are saved", "计时已开启，将保存通关用时") : t("Timer off — take it easy", "计时已关闭，慢慢探索吧")); };
$('#btnHelp').onclick = () => helpModal(onBuilder() ? 'build' : 'play');
async function refreshAuth(){
  try {
    const providers = await loadAuthProviders();
    session = providers.length ? await getSession() : null;
  } catch(error){ toast(t(error.message || 'Could not check sign-in', '暂时无法检查登录状态'), true); }
  if(session){   // hook(analytics): opaque id only; sign_in once, after the OAuth round-trip
    identify(session.user.id);
    try { const p = sessionStorage.getItem('klarbase.signin'); if(p){ sessionStorage.removeItem('klarbase.signin'); track('sign_in', { provider:p }); } } catch {}
  }
  const chip = $('#authchip'); chip.innerHTML = '';
  if(session){
    const who = document.createElement('span'); who.className = 'glass who'; who.textContent = session.user.name || session.user.email; who.title = who.textContent;
    const out = document.createElement('button'); out.className = 'btn small ghost'; out.textContent = t("Sign out", "退出登录");
    out.onclick = async () => {
      out.disabled = true;
      try {
        if(GITHUB_DEPLOYMENT) await flushCloudSave();
        await signOut();
        resetAnalytics();
        location.reload();
      } catch(error){
        out.disabled = false;
        toast(t(error.message || 'Could not sign out', '暂时无法退出登录，请重试。'), true);
      }
    };
    chip.append(who, out);
  } else if(signInProviders().length){
    const b = document.createElement('button'); b.className = 'btn small primary'; b.textContent = t("Sign in", "登录");   // hook(cloudsave): a clear pill
    b.onclick = () => openSignIn();
    chip.append(b);
  }
  updateGuestNote();
  syncOnSignIn(session);   // hook(cloudsave): merge this device's progress with the account's
}
function updateGuestNote(){
  const note = $('#scr-title .guest-note');
  if(!BRCLIO_DEPLOYMENT) return;
  if(GITHUB_DEPLOYMENT && signInProviders().length) note.textContent = t('Sign in to sync progress, comment, or share. Play and build without an account.', '游玩和建造无需账号。登录后可同步进度、发表评论或分享浮岛。');
  else note.textContent = STATIC_DEPLOYMENT ? t('Progress is saved in this browser.', '进度保存在当前浏览器。') : t('Play and build without an account.', '游玩和建造无需账号。');
}
$('#titleFoot')?.insertAdjacentHTML('beforeend', siteFoot()); // hook(repo)
if(BRCLIO_DEPLOYMENT){
  $('#btnGithub').href = REPO_URL;
  updateGuestNote();
  $('#scr-title .fine-links').remove();
}
// hook(cloudsave): the cloud merge refreshes whatever shows stars
initCloudSave({
  progress, dailies, toast,
  beforeScopeChange:() => {
    const wasMap = $('#scr-map').classList.contains('on');
    if(wasMap) stopMap();   // Map disposal saves its position under the previous scope.
    modal.close();
    return wasMap;
  },
  afterScopeChange:wasMap => { if(wasMap) nav('/map'); },
  refresh:() => {
    if($('#scr-select').classList.contains('on')) selectScreen(tab);
    else if($('#scr-title').classList.contains('on')) renderSkyStrip();
  },
});
document.addEventListener('click', e => {
  const provider = STATIC_DEPLOYMENT ? null : e.target.closest('[data-auth-provider]');
  if(provider){
    provider.disabled = true;
    startSignIn(provider.dataset.authProvider).catch(error => {
      provider.disabled = false;
      toast(t(error.message || 'Could not sign in', '暂时无法登录，请稍后重试。'), true);
    });
  }
  if(!BRCLIO_DEPLOYMENT && e.target.closest('.feedback-open')){ sfx.ui(); feedbackModal(); }
  const go = e.target.closest('[data-go]'); if(go){ e.preventDefault(); sfx.ui(); nav(go.dataset.go); }
  const hp = e.target.closest('[data-help]'); if(hp){ sfx.ui(); helpModal(hp.dataset.help); }
});

// ? opens How to build in the builder, How to play everywhere else; the tabs switch in place.
const onBuilder = () => ['/create', '/how-to-build'].includes(location.pathname.replace(/\/+$/, ''));
const helpTabs = which => `<div class="help-tabs"><button class="${which === 'play' ? 'on' : ''}" data-help="play">${t("How to play", "玩法指南")}</button><button class="${which === 'build' ? 'on' : ''}" data-help="build">${t("How to build", "建造指南")}</button></div>`;
function helpModal(which = 'play'){
  if(which === 'build'){
    store.set('klarbase.v2.guideSeen', true);
    return modal.open(`${helpTabs('build')}<h2>${t("How to build", "建造指南")}</h2>
      <p class="facts">${t("Every tile in the palette, what it does, how it’s stored and how to use it. The full file format is in ", "这里介绍每种地块的用途、写法和操作。完整格式请参阅 ")}<a href="${REPO_URL}/blob/main/isles/README.md" target="_blank" rel="noopener">isles/README.md</a>.</p>
      ${buildGuideHtml(TOOLS)}
      <div class="row"><button class="btn primary" onclick="document.getElementById('modal').classList.remove('on')">${t("Start building", "开始建造")}</button></div>`, true);
  }
  modal.open(`${helpTabs('play')}${mapCtl ? atlasHelp() : ''}<h2>${t("How to play", "玩法指南")}</h2>
    <div class="rules">
      <div><span class="ico">🐣</span><span>${helpText("move")}</span></div>
      <div><span class="ico">⬆</span><span>${helpText("height")}</span></div>
      <div><span class="ico">📦</span><span>${helpText("crate")}</span></div>
      <div><span class="ico">🧊</span><span>${helpText("ice")}</span></div>
      <div><span class="ico">◎</span><span>${helpText("gate")}</span></div>
      <div><span class="ico">🕹</span><span>${helpText("lever")}</span></div>
      <div><span class="ico">🔑</span><span>${helpText("arch")}</span></div>
      <div><span class="ico">⚖</span><span>${helpText("scales")}</span></div>
      <div><span class="ico">🎈</span><span>${helpText("balloon")}</span></div>
      <div><span class="ico">🥌</span><span>${helpText("stone")}</span></div>
      <div><span class="ico">🛟</span><span>${helpText("buoy")}</span></div>
      <div><span class="ico">💨</span><span>${helpText("gust")}</span></div>
      <div><span class="ico">🌱</span><span>${helpText("seed")}</span></div>
      <div><span class="ico">🪨</span><span>${helpText("hazards")}</span></div>
      <div><span class="ico">🗺</span><span>${helpText("map")}</span></div>
      <div><span class="ico">⭐</span><span>${helpText("star")}</span></div>
      <div><span class="ico">📈</span><span>${helpText("difficulty")}${BRCLIO_DEPLOYMENT ? t("Difficulty comes from the maker’s rating or the solver’s estimate.", "难度由作者评级或求解器估算得出。") : t("It starts as the maker’s guess and settles as people play.", "最初采用作者评级，之后会根据玩家成绩调整。")}</span></div>
    </div>
    ${BRCLIO_DEPLOYMENT ? '' : `<p class="facts" style="font-size:12.5px;font-weight:600;margin:10px 0 0">${t("Privacy: to rate difficulty, the game counts plays, clears, hints, restarts, moves and time per isle — anonymous totals with no account, cookie or IP address. Signing in sets one cookie and keeps your name, email and session details. ", "为评估难度，游戏按关卡匿名统计游玩、通关、提示、重来次数，以及步数和用时。统计不含账号、Cookie 或 IP 地址。登录会设置一个 Cookie，并保存你的姓名、邮箱及会话信息。")}<a href="/privacy" data-go="/privacy" style="color:inherit">${t("What's stored", "查看保存内容")}</a></p>`}
    ${siteFoot()}<!-- hook(repo) -->
    <div class="row">${BRCLIO_DEPLOYMENT ? '' : `<button class="btn feedback-open">${t("✉ Send feedback", "✉ 发送反馈")}</button>`}<button class="btn primary" onclick="document.getElementById('modal').classList.remove('on')">${t("Got it", "知道了")}</button></div>`);
}

// Sky Atlas: how the map works (shown first while exploring)
const atlasHelp = () => `<h2>${t('Sky Atlas', '天空星图')}</h2>
    <div class="rules">
      <div><span class="ico">🐣</span><span>${helpText("atlasMove")}</span></div>
      <div><span class="ico">⛩</span><span>${helpText("shrine")}</span></div>
      <div><span class="ico">✦</span><span>${helpText("beacon")}</span></div>
      <div><span class="ico">🗺</span><span>${helpText("atlas")}</span></div>
    </div><div style="height:6px"></div>`;

// Feedback: the way to reach the maker without a GitHub account (POST /api/feedback).
const FEEDBACK_MAX = 2000;   // = MESSAGE_MAX in server/src/routes/feedback.js
function feedbackModal(){
  modal.open(`<h2>${t("Send feedback", "发送反馈")}</h2>
    <p class="facts" style="font-weight:600;margin:6px 0 12px">${helpText("feedback")}</p>
    <div class="field" style="text-align:left"><label for="fbMsg">${t("Message", "反馈内容")}</label>
      <textarea id="fbMsg" maxlength="${FEEDBACK_MAX}" style="font-family:inherit;font-size:14.5px;white-space:pre-wrap"></textarea>
      <div class="facts" id="fbCount" style="font-size:12px;text-align:right">0 / ${FEEDBACK_MAX}</div></div>
    <div class="field" style="text-align:left"><label for="fbEmail">${t("Email for a reply (optional)", "接收回复的邮箱（选填）")}</label><input id="fbEmail" type="email" maxlength="254" autocomplete="email"></div>
    <p class="facts" style="font-size:12.5px;font-weight:600;margin:10px 0 0">${session ? t("Sent with your account. ", "将使用当前账号发送。") : ''}${t("No IP address is stored. ", "不会记录 IP 地址。")}<a href="/privacy" data-go="/privacy" style="color:inherit">${t("Privacy", "隐私")}</a></p>
    <div class="row"><button class="btn" id="fbCancel">${t("Cancel", "取消")}</button><button class="btn primary" id="fbSend">${t("Send", "发送")}</button></div>`);
  const msg = $('#fbMsg'), send = $('#fbSend');
  msg.oninput = () => { $('#fbCount').textContent = `${msg.value.length} / ${FEEDBACK_MAX}`; };
  msg.focus();
  $('#fbCancel').onclick = () => modal.close();
  send.onclick = async () => {
    if(!msg.value.trim()) return toast(t("Write a message first", "请先填写反馈内容"), true);
    send.disabled = true;
    try {
      await api('/feedback', { method:'POST', body:{ message:msg.value, email:$('#fbEmail').value.trim() || undefined, page:location.pathname } });
      modal.close(); toast(t("Thank you — feedback sent", "感谢反馈，消息已发送"));
    } catch(e){ send.disabled = false; toast(t(e.message, '反馈未能发送，请检查消息和邮箱后重试。'), true); }
  };
}

/* ---------------- title ---------------- */
const SHOWCASE = ['the-peak', 'palm-plates', 'canal-lift', 'rooftops', 'root-bridge', 'night-market', 'glacier-maze'];
function titleScreen(screen = 'title'){
  stopGame();
  const id = SHOWCASE[Math.floor(Math.random() * SHOWCASE.length)];
  const pick = CURATED_ISLES.find(i => i.id === id) || CURATED_ISLES[0];
  if(pick.id !== id) console.warn('[klarbase] showcase isle not found:', id, CURATED_ISLES.length);
  const { level } = parseIsle(pick);
  world.load(level, pick.theme, { showcase:true }); world.setShowcase(true); world.reset(initialState(level));
  setAccent(pick.theme); show(screen); renderSkyStrip();
  updateDailyButton();
}
function updateDailyButton(){
  const d = dailyEntry(); $('#btnDaily').textContent = d ? t(`☀ Daily #${d.daily.no}`, `☀ 每日浮岛 第 ${d.daily.no} 期`) : t("☀ Daily", "☀ 每日浮岛");
}

/* ---------------- choose an isle ---------------- */
function starsHtml(n){ return `<span class="stars">${'<b>★</b>'.repeat(n)}${'★'.repeat(3 - n)}</span>`; }

// A tiny map of the real isle — terraces, water, ice, props, the goal — drawn
// from its rows in the theme's colours, so every card previews its puzzle.
const thumbCache = new Map();
function thumb(doc){
  if(!doc || !(Array.isArray(doc.rows) || Array.isArray(doc.storeys))) return null;
  // a map draws every storey at its offset, higher storeys lifted and drawn last
  const parts = (doc.storeys || [{ rows:doc.rows, at:[0, 0, 0] }]).map(s => ({ grid:s.rows.map(r => r.trim().split(/\s+/)), at:s.at })).sort((a, b) => a.at[2] - b.at[2]);
  const key = doc.theme + JSON.stringify(doc.storeys || doc.rows);
  if(thumbCache.has(key)) return thumbCache.get(key);
  const T = themeOf(doc.theme), lift = k => parts[k].at[2] * 0.5;
  const w = Math.max(...parts.map(p => p.at[0] + p.grid[0].length)), h = Math.max(...parts.map((p, k) => p.at[1] + p.grid.length + lift(k)));
  const W = 240, H = 148, cs = Math.min((W - 24) / w, (H - 20) / h);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, T.sky[0]); sky.addColorStop(0.75, T.sky[1]); sky.addColorStop(1, T.sky[2]);
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  const ox0 = (W - cs * w) / 2, oy0 = (H - cs * h) / 2 + 2 + Math.max(...parts.map((p, k) => lift(k))) * cs;
  const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const f = v => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(n >> 16)},${f(n >> 8 & 255)},${f(n & 255)})`; };
  parts.forEach(({ grid, at }, k) => { const ox = ox0 + at[0] * cs, oy = oy0 + at[1] * cs - lift(k) * cs;
  for(let z = 0; z < grid.length; z++) for(let x = 0; x < grid[0].length; x++){
    const t = grid[z][x], ch = t[0], lv = +(t[1] || 0);
    if(ch === '-') continue;
    const px = ox + x * cs, py = oy + z * cs - lv * cs * 0.18;
    g.fillStyle = shade(T.strata[0], 0.8); g.fillRect(px, py + cs * 0.82, cs, cs * 0.3 + lv * cs * 0.18);   // cliff edge
    let top = T.top;
    if(ch === '~' || ch === '=' || ch === '_') top = T.water; else if(ch === '*') top = T.ice; else if(ch === '#') top = T.rock;
    g.fillStyle = shade(top, 0.9 + lv * 0.06); g.fillRect(px, py, cs, cs * 0.86);
    const dot = (col, r) => { g.fillStyle = col; g.beginPath(); g.arc(px + cs / 2, py + cs * 0.43, cs * r, 0, Math.PI * 2); g.fill(); };
    if(ch === 'T') dot(T.leaf, 0.38); else if(ch === 'G') dot(T.accent, 0.3); else if(ch === 'S') dot('#fff4e2', 0.26);
    else if(ch === 'C') { g.fillStyle = T.wood; g.fillRect(px + cs * 0.2, py + cs * 0.12, cs * 0.6, cs * 0.6); }
    else if(ch === 'p' || ch === 'q' || ch === 'r') dot({ p:'#4ff0ff', q:'#ff72d8', r:'#a6ff5c' }[ch], 0.28);
    else if(ch === 'a' || ch === 'b'){ g.fillStyle = T.woodDark; g.fillRect(px + cs * 0.1, py + cs * 0.1, cs * 0.8, cs * 0.66); g.fillStyle = T.top; g.fillRect(px + cs * 0.2, py + cs * 0.18, cs * 0.6, cs * 0.5); }
    else if(ch === 'k') dot('#ffd35c', 0.2); else if(ch === ',') dot(T.flora[0], 0.12);
  } });
  const url = c.toDataURL();
  thumbCache.set(key, url); return url;
}
function cardHtml(e, num){
  const T = themeOf(e.theme), p = progress[e.key], img = thumb(e.doc), lock = e.joins && lockOf(e);
  return `<button class="card${lock ? ' locked' : ''}" data-key="${esc(e.key)}"${lock ? ` data-locked="${esc(lock)}"` : ''}>
    <div class="sky" style="${img ? `background:url(${img}) center/cover` : `background:linear-gradient(180deg, ${T.sky[0]}, ${T.sky[1]} 75%, ${T.sky[2]})`}">
      ${num ? `<span class="num">${num}</span>` : ''}${tierBadge(e)}</div>
    <div class="body"><div class="name">${esc(e.name)}</div>
      ${e.author ? `<div class="credit">${t('by', '作者')} <a href="https://github.com/${esc(e.author)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">@${esc(e.author)}</a></div>` : ''}
      <div class="meta"><span>${e.par ? t(`par ${e.par}`, `最少 ${e.par} 步`) : T.label}${p ? t(` · best ${p.moves}`, ` · 最佳 ${p.moves} 步`) : ''}</span>${starsHtml(p ? p.stars : 0)}</div>
      ${lock ? `<div class="pstats lock">🔒 ${esc(lock)}</div>` : `<div class="pstats" data-stats="${esc(e.key)}">${statsLine(e)}</div>`}</div></button>`;
}
function selectScreen(which){
  stopGame(); tab = which; show('select'); loadPlays();
  if(tab === 'community' && !STATIC_DEPLOYMENT) loadOnline();
  renderPicker();
  const first = (tab === 'official' ? official : community)[0];
  if(first && !world.showcase){ const { level } = parseIsle(first.doc); world.load(level, first.theme, { showcase:true }); world.setShowcase(true); world.reset(initialState(level)); }
}
function renderPicker(){
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  const list = $('#selectList');
  if(tab === 'official'){
    list.innerHTML = CHAPTERS.map(ch => {
      const T = THEMES[ch.theme], isles = official.filter(e => chapterOf(e.doc) === ch);
      const got = isles.reduce((s, e) => s + (progress[e.key]?.stars || 0), 0);
      return `<div class="chapter"><div class="chapter-head"><h3>${gameText(ch.title)}</h3><span>${T.label} · ${gameText(ch.blurb || T.blurb)} · ${got}/${isles.length * 3} ★</span></div>
        <div class="grid">${isles.map(e => cardHtml(e, e.twist ? t('Twist', '变奏') : e.joins ? '✦' : e.num)).join('')}</div></div>`;
    }).join('');
  } else {
    list.innerHTML = `<div class="chapter"><div class="chapter-head"><h3>${t("Made by players", "玩家作品")}</h3><span>${t("merged on GitHub · every one checked solvable", "已合并到 GitHub · 每一关均已验证可解")}</span></div>
      <div class="grid">${community.map(e => cardHtml(e)).join('') || `<div class="empty">${t("No community isles yet — yours could be first.", "还没有社区浮岛，欢迎提交第一座！")}</div>`}</div>
      <p class="note" style="margin-top:14px">${t("Build an isle in <a href=\"/create\" data-go=\"/create\">Create</a>, press <b>Propose on GitHub</b>, and GitHub opens the pull request for you. Automated checks make sure it's solvable and fair, and you're credited by name. ", "在<a href=\"/create\" data-go=\"/create\">建造器</a>里设计一座浮岛，然后点<b>提交到 GitHub</b>创建拉取请求。自动检查会验证关卡可解且公平，通过后将署名收录。")}<a href="${REPO_URL}/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener">${t("Contributing guide →", "贡献指南 →")}</a></p></div>
      ${pastDailies().length ? `<div class="chapter"><div class="chapter-head"><h3>${t("Past Daily Isles", "往期每日浮岛")}</h3><span>${t("hand-made for one day · still here to play", "为那一天手工设计，今天还能来挑战")}</span></div>
        <div class="grid">${pastDailies().map(e => cardHtml(e, '#' + dailyNumber(e.date, DAILY_EPOCH_DATE))).join('')}</div></div>` : ''}
      ${STATIC_DEPLOYMENT ? '' : `<div class="chapter"><div class="chapter-head"><h3>${t("Shared online", "在线分享")}</h3><span>${t("fresh isles shared from the builder", "玩家从建造器分享的新浮岛")}</span></div><div class="grid" id="onlineGrid">${onlineGridHtml()}</div></div>`}`;
  }
}
let onlineRequest = 0, onlineFailure = false;
function onlineGridHtml(){
  let notice = t('Loading…', '加载中…');
  if(onlineFailure) notice = t('Online isles are unavailable right now.', '暂时无法加载在线浮岛。');
  else if(online){
    if(online.length) return online.map(e => cardHtml(e)).join('');
    notice = t('Nothing shared online yet.', '还没有玩家在线分享浮岛。');
  }
  return `<div class="empty">${notice}</div>`;
}
async function loadOnline(){
  const request = ++onlineRequest;
  online = null;
  onlineFailure = false;
  try {
    const r = await api('/puzzles?limit=30');
    if(request !== onlineRequest) return;
    online = r.puzzles.filter(p => p.isle).map(p => ({ key:'i:' + p.hash, statKey:'i/' + p.hash, hash:p.hash, name:p.title, theme:p.theme || 'jungle', author:null,
      par:p.par, tier:p.tier, audit:p.audit, get sub(){ return t(`shared by ${p.author.name}`, `${p.author.name} 分享`); }, online:true }));
  } catch {
    if(request !== onlineRequest) return;
    onlineFailure = true;
  }
  const grid = $('#onlineGrid');
  if(grid) grid.innerHTML = onlineGridHtml();
}
$('#selectList').addEventListener('click', e => {
  const c = e.target.closest('.card'); if(!c) return;
  sfx.ui();
  if(c.dataset.locked){ toast(t(`Not yet — ${c.dataset.locked} (clear ${CONFLUENCE_NEED} isles in each chapter)`, `尚未解锁：${c.dataset.locked}（每章需通关 ${CONFLUENCE_NEED} 座主线浮岛）`)); return; }
  const k = c.dataset.key;
  if(k.startsWith('o:')) nav('/isle/' + k.slice(2));
  else if(k.startsWith('c:')) nav('/c/' + k.slice(2));
  else if(k.startsWith('d:')) nav('/daily/' + k.slice(2));
  else nav('/i/' + k.slice(2));
});
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { nav(b.dataset.tab === 'official' ? '/play' : '/community'); });
// Continue skips Twist isles — they're an optional side path
$('#btnContinue').onclick = () => { const next = official.find(e => !progress[e.key] && !e.side) || official[0]; nav('/isle/' + next.doc.id); };

/* ---------------- play ---------------- */
function play(entry){
  const { ok, errors, level } = parseIsle(entry.doc);
  if(!ok){ toast(t('This isle is broken: ' + errors[0].text, '这座浮岛的地图文件有误，暂时无法游玩。'), true); nav('/play'); return; }
  stopGame(); stopMap();
  current = entry;
  world.setShowcase(false); world.view = 0; world.turn(0);
  world.load(level, entry.doc.theme); world.pip.group.visible = true;
  $('#btnMap').style.display = world.storeyCount > 1 ? '' : 'none'; syncMap();
  setAccent(entry.doc.theme);
  if(!entry.par){ const r = solveIsle(level, { maxStates:200000 }); entry.par = r.solvable ? r.par : 0; entry.solution = r.solution || ''; }
  let warned = false;   // the first hazard bonk of a visit explains itself
  game = new Session(world, level, entry, { onChange:hud, onWin:won, onEffort:addEffort,
    onHazard:() => { if(!warned){ warned = true; toast(t("Bonk! Something comes through there on the next beat — the glowing rings show where. Space waits a beat.", "撞到了！光圈标出了下一拍的危险位置，按空格键可以等待一拍。")); } } });
  freeHints = 1; attemptOpen = false;
  updateIsleHeading(entry);
  $('#btnComments').style.display = !STATIC_DEPLOYMENT && entry.statKey && !entry.draft ? '' : 'none';   // hook(comments): drafts/replays have no thread
  $('#statPar').textContent = entry.par || '–';
  $('#statKeysWrap').style.display = level.keys.length ? '' : 'none';
  $('#statSeedsWrap').style.display = level.seeds && level.seeds.length ? '' : 'none';
  // seed par: stored for official isles, otherwise worked out once, after the isle is on screen
  if(level.seeds && level.seeds.length && entry.seedPar == null){
    if(entry.doc.seedPar) entry.seedPar = entry.doc.seedPar;
    else setTimeout(() => { const r = solveSeeds(level, { maxStates:200000 }); entry.seedPar = r && r.solvable ? r.par : 0; }, 60);
  }
  $('#btnSolution').disabled = !entry.par;
  $('#keystrip').classList.remove('on');
  if(entry.hint) showTip(entry); else $('#hintText').style.display = 'none';
  hintStage = entry.hint ? 'tip' : 'move'; setHintLabel();
  show('game'); syncTopbar(); hud(game); loadPlays();
}
function updateIsleHeading(entry){
  $('#hudName').textContent = entry.name;
  $('#hudSub').innerHTML = tierBadge(entry) + ' ' + (entry.author && !entry.daily ? `${t('by', '作者')} <a href="https://github.com/${esc(entry.author)}" target="_blank" rel="noopener" style="color:inherit">@${esc(entry.author)}</a>` : esc(entry.sub || ''));   // tier first, so phones never ellipsize it away
}
// Restart button / R key. Restarting after some moves (and before a clear) is a stats signal.
function restartGame(){
  if(!game) return;
  if(game.moves > 0 && !game.won && !game.replaying) postPlay('restart');
  game.restart();
}
function stopGame(){ if(game){ game.stopReplay(); game = null; } modal.close(); }
function hud(s){
  if(s !== game) return;
  if(s.moves > 0 && !s.replaying && !s.won && !attemptOpen){ attemptOpen = true; postPlay('start'); }   // start = first real move
  $('#statMoves').textContent = s.moves;
  $('#statKeys').textContent = s.state.keys;
  if(s.level.seeds && s.level.seeds.length) $('#statSeeds').textContent = `${s.seeds.size}/${s.level.seeds.length}`;
  const replayIcon = s.replaying ? '■' : unlocked(current) ? '▶' : '🔒';
  const replayLabel = s.replaying ? t('Stop', '停止') : t('Solution', '解法');
  $('#btnSolution').innerHTML = `${replayIcon}<span class="lbl"> ${replayLabel}</span>`;
  $('#btnUndo').disabled = !s.history.length || s.replaying;
  $('#btnHint').disabled = s.won || s.replaying;
}
world.onFrame = () => { if(game && settings.timer) $('#statTime').textContent = fmtTime(game.time); };
const fmtTime = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

function won(s){
  const e = current, stars = starsFor(s.moves, e.par);
  const prev = progress[e.key], before = !e.draft && e.key.startsWith('o:') ? mySky() : null;
  if(!e.draft){
    const best = { stars:Math.max(stars, prev?.stars || 0), moves:Math.min(s.moves, prev?.moves ?? Infinity), time:settings.timer ? Math.min(s.time, prev?.time ?? Infinity) : prev?.time };
    if(s.level.seeds && s.level.seeds.length) best.seeds = Math.max(s.seeds.size, prev?.seeds || 0);
    progress[e.key] = best; writeProgress('progress', progress);
  }
  if(e.daily){ dailies[e.daily.date] = Math.max(stars, dailies[e.daily.date] || 0); writeProgress('dailies', dailies); }
  if(!e.draft) pushSoon();   // hook(cloudsave): debounced save to the account (no-op signed out)
  const news = before ? skyNews(before, mySky()) : { html:'', open:null };
  postPlay('clear', { moves:s.moves, ms:Math.round(s.time * 1000) }); attemptOpen = false;
  // the main path skips side paths (Twist, Confluence); a daily has no "next"
  const next = e.index != null && !e.daily && !e.fromMap ? official.slice(e.index + 1).find(x => !x.side) : null;
  const share = e.daily ? t(dailyShareText({ no:e.daily.no, moves:s.moves, par:e.par, stars }),
    `Klarbase 每日浮岛 第 ${e.daily.no} 期 · ${s.moves} 步${e.par ? `（最少 ${e.par} 步）` : ''} · ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`) : null;
  const shareUrl = location.origin + (e.archived ? '/daily/' + e.daily.date : '/daily');
  modal.open(`<h2>${e.daily ? t(`Daily #${e.daily.no} cleared!`, `每日浮岛 第 ${e.daily.no} 期通关！`) : t("Isle cleared!", "浮岛通关！")}</h2>
    <div class="big-stars">${[0, 1, 2].map(i => `<span class="${i < stars ? 'lit' : ''}" style="animation-delay:${0.15 + i * 0.18}s">★</span>`).join('')}</div>
    <div class="facts">${t(`${s.moves} moves · par ${e.par || '?'}`, `用了 ${s.moves} 步 · 最少 ${e.par || '?'} 步`)}${settings.timer ? ' · ' + fmtTime(s.time) : ''}${s.hintsUsed ? t(` · ${s.hintsUsed} hint${s.hintsUsed > 1 ? 's' : ''}`, ` · 提示 ${s.hintsUsed} 次`) : ''}</div>
    ${stars < 3 && e.par && !(s.level.seeds && s.level.seeds.length && s.seeds.size === s.level.seeds.length) ? `<div class="facts" style="font-weight:600;margin-top:4px">${t(`The smart route takes ${e.par} moves — watch it?`, `最短路线只需 ${e.par} 步，看看是怎么走的？`)}</div>` : ''}
    ${seedLine(s, e)}
    ${news.html}
    ${e.catch ? `<div class="note" style="margin-top:10px;text-align:left"><b>${t("The catch:", "解题巧思：")}</b> ${esc(e.catch)}</div>` : ''}
    ${movesHistogram(e, s.moves)}
    ${crowdLine(e, s.moves)}
    ${share ? `<div class="share-text" id="wShareText">${esc(share)}<br><small>${esc(shareUrl)}</small></div>` : ''}
    <div class="row">
      ${share ? `<button class="btn primary" id="wDaily">${t("📋 Copy result", "📋 复制成绩")}</button>` : ''}
      ${news.open ? `<button class="btn primary" id="wConf">${t(`✦ Play ${esc(news.open.name)}`, `✦ 挑战《${esc(news.open.name)}》`)}</button>` : ''}
      ${e.fromMap ? `<button class="btn primary" id="wMap">${t("🗺 Return to map", "🗺 返回地图")}</button>` : ''}
      ${next ? `<button class="btn primary" id="wNext">${t("Next isle ▶", "下一座浮岛 ▶")}</button>` : ''}
      ${e.draft ? `<button class="btn primary" id="wBuild">${t("Back to builder", "返回建造器")}</button>` : ''}
      <button class="btn" id="wAgain">${t("⟲ Again", "⟲ 再玩一次")}</button>
      ${e.par && unlocked(e) ? `<button class="btn" id="wWatch">${t("▶ Watch solution", "▶ 观看解法")}</button>` : ''}
      ${e.online ? `<button class="btn" id="wShare">${t("🔗 Copy link", "🔗 复制链接")}</button>` : ''}
      ${!e.draft && !e.fromMap ? `<button class="btn ghost" id="wList">${t("All isles", "所有浮岛")}</button>` : ''}
    </div>
    ${!STATIC_DEPLOYMENT && e.statKey && !e.draft ? `<div class="facts" style="margin-top:10px"><a href="#" id="wComments">${t("💬 Comments", "💬 评论")}</a></div>` : ''}`);   // hook(comments)
  if($('#wComments')){ const wc = $('#wComments'); wc.onclick = ev => { ev.preventDefault(); commentsOpen(e); }; commentCount(e.statKey).then(n => { if(n != null && wc.isConnected) wc.textContent = t(`💬 Comments (${n})`, `💬 评论（${n}）`); }); }   // hook(comments)
  // spoiler-free daily result: moves, par and stars — never the route
  const copyShare = quiet => (navigator.clipboard ? navigator.clipboard.writeText(`${share}\n${shareUrl}`) : Promise.reject())
    .then(() => toast(t("Result copied — no spoilers inside", "已复制成绩，里面没有解法")), () => quiet || toast(t("Copy failed — select the text above", "复制失败，请选中上方文字复制"), true));
  if(share){ $('#wDaily').onclick = () => copyShare(false); copyShare(true); }   // try right away; the button is the reliable path
  $('#wConf') && ($('#wConf').onclick = () => { nav('/isle/' + news.open.doc.id); });
  $('#wMap') && ($('#wMap').onclick = () => { nav(mapUrl(e)); });
  $('#wNext') && ($('#wNext').onclick = () => { nav('/isle/' + next.doc.id); });
  $('#wBuild') && ($('#wBuild').onclick = () => { nav('/create'); });
  $('#wAgain').onclick = () => { modal.close(); game.restart(); };
  $('#wWatch') && ($('#wWatch').onclick = () => { modal.close(); watch(); });
  $('#wShare') && ($('#wShare').onclick = () => navigator.clipboard.writeText(location.href).then(() => toast(t("Link copied", "链接已复制"))));
  $('#wList') && ($('#wList').onclick = () => { nav(e.archived ? '/community' : e.daily ? '/play' : e.author ? '/community' : '/play'); });
}

// Seeds (Phase 3) are optional: how many you found, and the seed par once all are in.
function seedLine(s, e){
  const n = s.level.seeds ? s.level.seeds.length : 0;
  if(!n) return '';
  const all = s.seeds.size === n;
  return `<div class="facts" style="margin-top:4px">🌱 ${t(`${s.seeds.size} of ${n} seed${n > 1 ? 's' : ''}`, `种子 ${s.seeds.size}/${n}`)}${all && e.seedPar ? ` · ${s.moves <= e.seedPar ? t("seed par!", "已用最少步数收齐种子！") : t(`seed par ${e.seedPar}`, `全种子最少 ${e.seedPar} 步`)}` : !all ? t(" — they’re off the short route", " · 想收齐种子，需要绕点路") : ''}</div>`;
}
// How everyone else cleared it (K7 sums, no one in particular): moves from par to
// par + 8 or more, your bar lit. Shown once a few people have cleared the isle.
function movesHistogram(e, mine){
  const h = e.statKey && plays[e.statKey] && plays[e.statKey].moves;
  if(!h || !e.par) return '';
  const cols = Array.from({ length:9 }, () => 0);
  let total = 0;
  for(const [k, c] of Object.entries(h)){ const m = +k, n = +c || 0; if(m > 0 && n > 0){ cols[Math.max(0, Math.min(8, m - e.par))] += n; total += n; } }
  if(total < 3) return '';
  const max = Math.max(...cols), you = Math.max(0, Math.min(8, mine - e.par));
  return `<div class="hist-cap">${t(`How players cleared it · ${total} clear${total > 1 ? 's' : ''}`, `玩家通关步数 · 共 ${total} 次通关`)}</div>
    <div class="hist">${cols.map((n, k) => `<i class="${k === you ? 'you' : ''}" style="height:${4 + Math.round(40 * n / max)}px" title="${t(`${e.par + k}${k === 8 ? '+' : ''} moves: ${n}`, `${e.par + k}${k === 8 ? '+' : ''} 步：${n} 次`)}"></i>`).join('')}</div>
    <div class="hist-axis"><span>${t(`par ${e.par}`, `最少 ${e.par} 步`)}</span><span>${e.par + 8}+</span></div>`;
}

// screen arrow for a world move in the current view — keeps hints & replays readable after turning
const ARROW_GLYPH = { up:'↑', right:'→', down:'↓', left:'←' };
function glyphFor(move){
  if(move === 'X') return '⎵';
  for(const a of ['up', 'right', 'down', 'left']) if(world.arrowToMove(a) === move) return ARROW_GLYPH[a];
  return move;
}
/* ---------------- earned solutions ---------------- */
// The smart solution is earned, not handed out. It unlocks for an isle when you
// are signed in, OR you've cleared that isle, OR you've put in real effort on it
// — only time spent actively moving counts (idle gaps are ignored), plus a
// minimum number of moves. A soft gate by design: the engine ships a solver and
// the repo is open source; the point is to protect the "aha" for players who try.
const EFFORT = { seconds:180, minMoves:30, parMult:3 };
const effort = store.get('klarbase.v2.effort', {});
let freeHints = 1;
const effortNeed = e => ({ t:EFFORT.seconds, m:Math.max(EFFORT.minMoves, (e?.par || 10) * EFFORT.parMult) });
function unlocked(e){
  if(!e) return false;
  if(session || progress[e.key]) return true;
  const f = effort[e.key], need = effortNeed(e);
  return !!f && f.t >= need.t && f.m >= need.m;
}
function addEffort(dt){
  if(!current || current.draft) return;
  const was = unlocked(current), f = effort[current.key] ||= { t:0, m:0 };
  f.t += dt; f.m += 1; store.set('klarbase.v2.effort', effort);
  if(!was && unlocked(current)){ toast(t("🔓 You’ve earned the solution for this isle", "🔓 你已解锁这座浮岛的解法")); hud(game); }
}
function lockModal(what = 'solution'){
  const e = current, f = effort[e.key] || { t:0, m:0 }, need = effortNeed(e);
  const canSignIn = signInProviders().length > 0;
  const target = what === 'solution' ? '解法' : '下一步提示';
  const bar = (v, max) => `<div style="height:8px;border-radius:99px;background:rgba(42,34,56,.08);overflow:hidden;margin:4px 0 10px"><div style="height:100%;width:${Math.min(100, v / max * 100)}%;background:var(--accent)"></div></div>`;
  modal.open(`<h2>${t(`🔒 Earn the ${what}`, `🔒 解锁${target}`)}</h2>
    <p class="facts" style="font-weight:600">${t(`Smart routes are for players who've tried. Unlock this isle's ${what} any of ${canSignIn ? 'three' : 'two'} ways:`, `以下${canSignIn ? '三' : '两'}种方式均可解锁这座浮岛的${target}。`)}</p>
    <div class="rules">
      ${canSignIn ? `<div><span class="ico">🔑</span><span>${helpText("signin")}</span></div>` : ''}
      <div><span class="ico">⭐</span><span>${helpText("clear")}</span></div>
      <div><span class="ico">🐣</span><span style="flex:1">${helpText("effort")}
        <div style="font-size:12.5px;margin-top:6px">${t(`${fmtTime(Math.min(f.t, need.t))} / ${fmtTime(need.t)} active play`, `移动时长 ${fmtTime(Math.min(f.t, need.t))} / ${fmtTime(need.t)}`)}</div>${bar(f.t, need.t)}
        <div style="font-size:12.5px">${t(`${Math.min(f.m, need.m)} / ${need.m} moves`, `移动步数 ${Math.min(f.m, need.m)} / ${need.m}`)}</div>${bar(f.m, need.m)}</span></div>
    </div>
    <div class="row">${session ? '' : signInButtons('Sign in with')}
      <button class="btn ghost" onclick="document.getElementById('modal').classList.remove('on')">${t("Keep playing", "继续游戏")}</button></div>`);
}

function watch(){
  if(!game || !current.par) return;
  if(game.replaying){ game.stopReplay(); $('#keystrip').classList.remove('on'); return; }
  if(!unlocked(current)) return lockModal('solution');
  if(!current.solution){ const r = solveIsle(game.level, { maxStates:200000 }); current.solution = r.solution || ''; if(!r.solvable) return; }   // shared isles: solve locally once earned
  const strip = $('#keystrip');
  strip.innerHTML = [...current.solution].map(m => `<span class="k">${glyphFor(m)}</span>`).join('');
  strip.classList.add('on');
  game.replay(current.solution, i => {
    [...strip.children].forEach((k, j) => { k.className = 'k' + (j < i ? ' done' : j === i ? ' now' : ''); });
    if(i < 0) setTimeout(() => strip.classList.remove('on'), 600);
  });
}
// Hint is two-stage (player feedback): the first press re-shows the isle's written tip
// (free, always); after that it's "next move" from the solver, which keeps the free-hint
// limit. A hint is only spent when a move is actually shown — never mid-hop.
let hintStage = 'tip';
function showTip(entry){
  const ht = $('#hintText');
  ht.textContent = entry.hint; ht.style.opacity = 1; ht.style.display = '';
  clearTimeout(play.ht); play.ht = setTimeout(() => ht.style.opacity = 0, 9000);
}
function setHintLabel(){
  const tip = hintStage === 'tip', b = $('#btnHint');
  const label = tip ? t('Tip', '提示') : t('Next move', '下一步');
  b.innerHTML = `${tip ? '💡' : '🧭'}<span class="lbl"> ${label}</span> <span class="kbd">H</span>`;
  b.title = tip ? t("Show this isle’s tip (H)", "查看本关提示（H）") : t("Best next move from here (H)", "查看当前位置的最佳下一步（H）");
}
function hint(){
  if(!game || game.won || game.replaying || game.busy) return;
  if(hintStage === 'tip'){ showTip(current); hintStage = 'move'; setHintLabel(); return; }
  if(!unlocked(current) && freeHints <= 0) return lockModal('hints');
  const h = game.hint();
  if(!h) return;
  if(!unlocked(current)) freeHints--;
  postPlay('hint');
  if(h.stuck) toast(t("Hmm — this spot can’t reach the goal any more. Undo or restart.", "从这里已经走不到终点了，试试撤销或重来。"), true);
  else {
    const action = h.move === 'X' ? (game.level.hazards?.length ? t('Use or wait', '使用或等待') : t('Use', '使用')) + t(' (Space)', '（空格键）') : glyphFor(h.move);
    const message = t(`Best next move: ${action} · ${h.left} to go`, `建议下一步：${action} · 还需 ${h.left} 步`);
    toast(message + (unlocked(current) ? '' : t(' · that was your free hint', ' · 免费提示已使用')));
  }
}
$('#btnBack').onclick = () => { nav(current?.fromMap ? mapUrl(current) : current?.draft ? '/create' : current?.archived ? '/community' : current?.daily ? '/' : current?.author ? '/community' : current?.online ? '/community' : '/play'); };
$('#btnUndo').onclick = () => game && game.undo();
$('#btnRestart').onclick = restartGame;
$('#btnHint').onclick = hint;
$('#btnSolution').onclick = watch;
/* ---------------- Sky Atlas ---------------- */
const mapUrl = e => `/map/${e.fromMap.x},${e.fromMap.z}`;
// shrine key ('o/<id>' · 'c/<author>/<id>' · 'd/<date>') -> the catalogue entry the picker would play
function mapEntry(k){
  if(k.startsWith('o/')) return official.find(e => e.doc.id === k.slice(2));
  if(k.startsWith('c/')){ const [, a, i] = k.split('/'); return community.find(e => e.author === a && e.doc.id === i); }
  if(k.startsWith('d/')){ const e = dailyEntry(k.slice(2)); return e && Object.assign(e, { archived:true }); }
  return null;
}
function stopMap(){ mapToken++; if(mapCtl){ mapCtl.dispose(); mapCtl = null; if(import.meta.env.DEV) delete window.__klar.map; } }
async function openMap(start){
  stopGame(); stopMap(); const my = ++mapToken;
  world.setShowcase(false); show('map'); syncTopbar();
  let mod; try { mod = await import('./map/index.js'); } catch(e){ console.error(e); toast(t("The map could not be loaded", "暂时无法加载地图"), true); if(my === mapToken) nav('/'); return; }
  if(my !== mapToken) return;
  mapCtl = mod.mountMap({ world, start, progress, community, dated:pastDailies(), entryFor:mapEntry, badge:tierBadge, starsHtml, onSave:pushSoon,
    lockOf:e => e.joins ? lockOf(e) : null, play, nav, track, setAccent });
  if(import.meta.env.DEV) window.__klar.map = mapCtl;
}
// hook(comments): `unlocked(current)` is the same earned-solution test, so a thread's spoilers stay gated with it
const commentsOpen = e => openComments(e, { modal, unlocked:unlocked(e), signedIn:!!session, onSignIn:() => openSignIn() });
if(!STATIC_DEPLOYMENT) $('#btnComments').onclick = () => current && current.statKey && !current.draft && commentsOpen(current);
$('#btnTurn').onclick = () => { world.turn(1); sfx.ui(); };
// Archipelago maps: the camera frames Pip's storey; M (or the button) shows the whole map.
const syncMap = () => $('#btnMap').classList.toggle('primary', world.mapView);
function toggleMap(){ if(world.storeyCount < 2) return; world.setMapView(!world.mapView); syncMap(); sfx.ui(); }
$('#btnMap').onclick = toggleMap;

/* ---------------- input ---------------- */
const KEYS = { ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right', w:'up', s:'down', a:'left', d:'right', W:'up', S:'down', A:'left', D:'right' };
addEventListener('keydown', e => {
  unlockAudio();
  if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
  if(e.key === 'Escape'){ if($('#modal').classList.contains('on')) return modal.close(); if(mapCtl) return mapCtl.onKey(e, true); if(game?.replaying) return watch(); if(game) return $('#btnBack').click(); }
  if(mapCtl){ if(!$('#modal').classList.contains('on')) mapCtl.onKey(e, true); return; }
  if(!game || $('#modal').classList.contains('on')) return;
  if(KEYS[e.key]){ e.preventDefault(); game.input(world.arrowToMove(KEYS[e.key])); return; }
  switch(e.key){
    case ' ': case 'Enter': case 'x': case 'X': e.preventDefault(); game.input('X'); break;
    case 'z': case 'Z': case 'Backspace': e.preventDefault(); game.undo(); break;
    case 'r': case 'R': restartGame(); break;
    case 'h': case 'H': hint(); break;
    case 'q': case 'Q': world.turn(-1); break;
    case 'e': case 'E': world.turn(1); break;
    case 'm': case 'M': toggleMap(); break;
  }
});
addEventListener('keyup', e => { if(mapCtl) mapCtl.onKey(e, false); });
addEventListener('blur', () => { if(mapCtl) mapCtl.releaseAll(); });
document.querySelectorAll('.dpad [data-arrow]').forEach(b => {
  b.addEventListener('pointerdown', e => {
    e.preventDefault(); unlockAudio();
    if(mapCtl) return mapCtl.press(b.dataset.arrow);
    if(!game) return;
    const a = b.dataset.arrow; game.input(a === 'use' ? 'X' : world.arrowToMove(a));
  });
  for(const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => mapCtl && mapCtl.release(b.dataset.arrow));
});
let swipe = null;
$('#stage').addEventListener('pointerdown', e => { unlockAudio(); swipe = { x:e.clientX, y:e.clientY }; });
$('#stage').addEventListener('pointerup', e => {
  if(!swipe || (!game && !mapCtl)) return; const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y; swipe = null;
  if(Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
  const arrow = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  if(mapCtl) mapCtl.swipe(arrow); else game.input(world.arrowToMove(arrow));
});
addEventListener('pointerdown', () => unlockAudio(), { once:true });

/* ---------------- builder ---------------- */
const builder = mountBuilder({ world, api, toast, repoUrl:REPO_URL, communityHashes, getSession:() => session, canSeeSolutions:() => !!session, openGuide:() => helpModal('build'),
  onTest:doc => { play({ key:'draft', doc, name:doc.name, theme:doc.theme, par:doc.par, solution:doc.solution, tier:doc.tier, get sub(){ return t('testing your isle', '试玩自己的浮岛'); }, draft:true }); } });

/* ---------------- routing ---------------- */
// Real paths (/isle/root-bridge), not #/ hashes. The server answers every path with
// index.html; old #/ links (shared before the switch) are rewritten on arrival.
// In-game navigation REPLACES the address instead of adding history: the browser's
// Back leaves the game, the in-game back button moves between screens (player feedback).
function nav(path){
  if(path !== location.pathname) history.replaceState(null, '', path);
  route();
}
async function route(){
  if(location.hash.startsWith('#/')) history.replaceState(null, '', location.hash.slice(1));
  const h = location.pathname.replace(/\/+$/, '') || '/';
  let m;
  if(!h.startsWith('/map')) stopMap();
  track('pageview', { path:h });   // hook(analytics)
  if(h === '/') return titleScreen();
  if(LEGAL_PAGES.includes(h.slice(1))){ titleScreen('legal'); return showLegal(h.slice(1)); }   // hook(legal): privacy · terms · guidelines · imprint · licenses, over the showcase isle
  if(h === '/map') return openMap(null);
  if((m = /^\/map\/(-?\d{1,7}),(-?\d{1,7})$/.exec(h))) return openMap({ x:+m[1], z:+m[2] });
  if(h === '/play') return selectScreen('official');
  if(h === '/community') return selectScreen('community');
  if(h === '/daily'){ const e = dailyEntry(); return e ? play(e) : nav('/play'); }
  // A past hand-made daily (the Community tab's shelf). The dev server also opens
  // any date, so the daily isle agent (K10) can playtest before the day — live never does.
  if((m = /^\/daily\/(\d{4}-\d{2}-\d{2})$/.exec(h))){
    if(m[1] === utcDate() && !import.meta.env.DEV) return nav('/daily');
    const past = m[1] < utcDate() && DATED.some(x => x.date === m[1]);
    const e = (past || import.meta.env.DEV) && dailyEntry(m[1]);
    return e ? play(Object.assign(e, { archived:past })) : nav('/community');
  }
  if(h === '/create' || h === '/how-to-build'){
    track('builder_open');   // hook(analytics)
    stopGame(); world.setShowcase(false); show('create'); builder.show(); setAccent(builder.draft.theme);
    if(h === '/how-to-build') helpModal('build');
    else if(!store.get('klarbase.v2.guideSeen', false)) toast(t("New here? Press ? for How to build", "第一次建造？点问号查看建造指南"));
    return;
  }
  if((m = /^\/isle\/([\w-]+)$/.exec(h))){ const e = official.find(x => x.doc.id === m[1]); return e ? play(e) : nav('/play'); }
  if((m = /^\/c\/([\w-]+)\/([\w-]+)$/.exec(h))){ const e = community.find(x => x.author === m[1] && x.doc.id === m[2]); return e ? play(e) : nav('/community'); }
  if((m = /^\/(?:i|p)\/([0-9a-f]{64})$/.exec(h))){
    if(STATIC_DEPLOYMENT){ toast(t("Online isle links are unavailable in this edition", "这个版本无法打开在线浮岛链接"), true); return nav('/community'); }
    try {
      const r = await api('/puzzles/' + m[1]);
      if(!SCHEMAS.includes(r.puzzle.schemaVersion)){ toast(t("That link is from an older version of Klarbase", "这条链接来自旧版 Klarbase"), true); nav('/community'); return; }
      return play({ key:'i:' + m[1], statKey:'i/' + m[1], tier:r.puzzle.tier, audit:r.puzzle.audit, doc:{ ...r.puzzle, name:r.title }, name:r.title, theme:r.puzzle.theme, par:r.puzzle.par, solution:r.puzzle.solution, get sub(){ return t(`shared by ${r.author.name}`, `${r.author.name} 分享`); }, online:true });
    } catch { toast(t("That isle could not be found", "找不到这座浮岛"), true); nav('/community'); return; }
  }
  nav('/');
}
function updateLanguage(){
  updateGuestNote();
  syncTopbar();
  const authButton = $('#authchip button');
  if(authButton) authButton.textContent = session ? t('Sign out', '退出登录') : t('Sign in', '登录');
  if($('#scr-title').classList.contains('on')){ updateDailyButton(); renderSkyStrip(); }
  if($('#scr-select').classList.contains('on')) renderPicker();
  if(game && current){
    updateIsleHeading(current);
    if(current.hint) $('#hintText').textContent = current.hint;
    setHintLabel();
    hud(game);
  }
}
onLanguageChange(updateLanguage);
syncTopbar();
initAnalytics();   // hook(analytics)
if(GITHUB_DEPLOYMENT){
  const url = new URL(location.href);
  const signInResult = url.searchParams.get('sign-in');
  if(signInResult){
    url.searchParams.delete('sign-in');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
    toast(signInResult === 'cancelled' ? t("Sign-in cancelled", "已取消登录") : t("Could not complete sign-in", "登录未能完成"), true);
  }
  refreshAuth().finally(route);
} else {
  if(!STATIC_DEPLOYMENT) refreshAuth();
  route();
}
