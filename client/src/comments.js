// Per-isle comment threads (server: /api/comments). Renders into main.js's modal.
// Comment bodies are user text: only ever set via textContent, never innerHTML.
// SPOILER GATE: until the player has "earned" the isle (same condition as the
// solution), bodies are blurred behind one button — threads may hint at routes.
import { api } from './net.js';
import { track } from './analytics.js';
import { getLanguage, t } from './i18n.js';

const MAX = 500;
const counts = new Map();                 // statKey -> total comments (cached; kept in step by post/delete)
const pending = new Map();                // statKey -> in-flight count promise

// Total comments for an isle, or null if unknown/offline. Cached per session.
export function commentCount(key){
  if(!key) return Promise.resolve(null);
  if(counts.has(key)) return Promise.resolve(counts.get(key));
  if(!pending.has(key)) pending.set(key,
    api('/comments?limit=1&key=' + encodeURIComponent(key)).then(r => { counts.set(key, r.count); return r.count; }, () => null)
      .finally(() => pending.delete(key)));
  return pending.get(key);
}

const css = `
.cm h2{ margin:0 0 4px } .cm .sub{ color:var(--ink-2); font-weight:700; font-size:14px; margin:0 0 12px }
.cm .list{ text-align:left; display:flex; flex-direction:column; gap:12px; margin:12px 0; max-height:46vh; overflow:auto; padding-right:2px }
.cm .list.spoil .item:not(.own) .body{ filter:blur(7px); user-select:none; pointer-events:none }
.cm .item{ display:flex; gap:10px; align-items:flex-start }
.cm .av{ width:32px; height:32px; border-radius:50%; flex:none; background:rgba(42,34,56,.12); display:grid; place-items:center; font-weight:800; font-size:14px; overflow:hidden }
.cm .av img{ width:100%; height:100%; object-fit:cover; display:block }
.cm .main{ flex:1; min-width:0 } .cm .meta{ font-size:12.5px; color:var(--ink-2); font-weight:700 }
.cm .meta b{ color:inherit; font-weight:800; margin-right:6px } .cm .body{ white-space:pre-wrap; overflow-wrap:anywhere; font-weight:600; font-size:14.5px; margin-top:2px }
.cm .acts{ margin-top:4px } .cm .acts button{ all:unset; cursor:pointer; font-size:12px; font-weight:800; color:var(--ink-2); text-decoration:underline; margin-right:12px }
.cm .acts button:disabled{ cursor:default; text-decoration:none; opacity:.7 }
.cm .empty,.cm .err{ color:var(--ink-2); font-weight:700; font-size:14px; padding:6px 0 } .cm .err{ color:#b4233c }
.cm textarea{ width:100%; box-sizing:border-box; min-height:74px; resize:vertical; font:inherit; font-weight:600; padding:10px 12px; border-radius:14px; border:2px solid rgba(42,34,56,.14); background:rgba(255,255,255,.7); color:inherit }
.cm .cnt{ font-size:12px; font-weight:800; color:var(--ink-2); text-align:right; margin:2px 2px 0 } .cm .note{ font-size:12.5px; font-weight:700; color:var(--ink-2); text-align:left; margin:2px 0 }
.cm .spoiler{ text-align:left; font-size:13px; font-weight:700; color:var(--ink-2); margin:0 0 8px }
.cm .row{ margin-top:10px }
`;
let styled = false;
const el = (tag, cls, text) => { const n = document.createElement(tag); if(cls) n.className = cls; if(text != null) n.textContent = text; return n; };
const btn = (label, cls = 'btn') => { const b = el('button', cls, label); b.type = 'button'; return b; };

const relativeTimes = new Map();
function ago(iso){
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  const lang = getLanguage();
  if(!relativeTimes.has(lang)) relativeTimes.set(lang, typeof Intl !== 'undefined' && typeof Intl.RelativeTimeFormat === 'function' ? new Intl.RelativeTimeFormat(lang, { numeric:'auto' }) : null);
  const formatter = relativeTimes.get(lang);
  for(const [unit, sec] of [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]])
    if(Math.abs(s) >= sec) return formatter ? formatter.format(Math.round(s / sec), unit) : new Date(iso).toLocaleDateString(lang);
  return t('just now', '刚刚');
}

const commentErrors = {
  'write a comment first':'请先写下评论。',
  'keep it under 500 characters':'评论最多可写 500 个字符。',
  'plain text only':'请使用纯文本。',
  'no links, please — plain text only':'请使用纯文本，不要附上链接。',
  'Describe the idea, not the keys — routes are earned in Klarbase.':'可以分享解题思路，请把具体按键路线留给其他玩家发现。',
  'that one is yours — delete it instead':'这是你自己的评论，可以直接删除。',
  'login required':'请先登录。',
  'report limit reached':'举报过于频繁，请稍后再试。',
  'comment limit reached — 20 per hour':'每小时最多发表 20 条评论，请稍后再试。',
  'unknown isle key':'找不到这座浮岛。',
  'unknown isle':'找不到这座浮岛。',
  'invalid comment cursor':'评论列表已变化，请重新打开。',
  'not found':'找不到这条评论。',
  'Game storage temporarily unavailable':'存储服务暂时不可用，请稍后再试。',
  'Failed to fetch':'无法连接服务器，请检查网络。',
};
function commentError(error){
  return t(error.message, commentErrors[error.message] || (error.status ? `请求失败（HTTP ${error.status}），请稍后再试。` : '无法完成请求，请检查网络后重试。'));
}

function avatar(a){
  const d = el('div', 'av', (a.name || '?').trim().slice(0, 1).toUpperCase());
  if(a.image){
    const i = document.createElement('img');
    i.referrerPolicy = 'no-referrer'; i.loading = 'lazy'; i.alt = ''; i.width = 32; i.height = 32;
    i.onload = () => d.replaceChildren(i);          // keep the initial until the image really loads
    i.src = a.image;
  }
  return d;
}

// entry: { statKey, name }. opts: { modal, unlocked, signedIn, onSignIn } — unlocked/signedIn may be booleans or functions.
export function openComments(entry, opts = {}){
  const key = entry && entry.statKey;
  if(!key || !opts.modal) return;
  if(!styled){ styled = true; const s = document.createElement('style'); s.textContent = css; document.head.append(s); }
  const val = v => typeof v === 'function' ? v() : !!v;
  const signedIn = val(opts.signedIn);
  let revealed = val(opts.unlocked), next = null, total = 0;

  opts.modal.open('');
  const root = el('div', 'cm');
  document.getElementById('modalBody').replaceChildren(root);
  root.append(el('h2', null, t('💬 Comments', '💬 评论')), el('div', 'sub', entry.name || ''));

  const gate = el('div', 'spoiler');
  const list = el('div', 'list' + (revealed ? '' : ' spoil'));
  const status = el('div', 'empty', t('Loading…', '正在加载…'));
  const more = btn(t('Load more', '加载更多'), 'btn small'); more.style.display = 'none';
  let loaded = false;
  const sync = () => {
    const n = list.children.length;
    status.style.display = n ? 'none' : '';
    if(loaded && !n) status.textContent = t('No comments yet — say something kind, or share an idea (never the route).', '还没有评论。聊聊你喜欢的地方，或留下不剧透的提示吧。');
    list.classList.toggle('spoil', !revealed);
    gate.style.display = !revealed && n ? '' : 'none';
  };
  gate.append(el('div', null, t('Comments may hint at the solution, so they stay blurred until you’ve cleared this isle, signed in or tried hard.', '评论里可能有解题提示。通关这座浮岛、登录或充分尝试后，就能直接看到评论。')));
  const show = btn(t('Show comments anyway', '仍然查看评论'), 'btn small'); show.style.marginTop = '6px';
  show.onclick = () => { revealed = true; sync(); };
  gate.append(show); gate.style.display = 'none';

  function item(c){
    const row = el('div', 'item' + (c.mine ? ' own' : '')), main = el('div', 'main'), meta = el('div', 'meta');
    meta.append(el('b', null, c.author.name || t('Someone', '一位玩家')), document.createTextNode(ago(c.createdAt)));
    const acts = el('div', 'acts');
    if(c.mine){
      const del = btn(t('Delete', '删除'), ''); del.onclick = async () => {
        if(!confirm(t('Delete this comment?', '确定删除这条评论吗？'))) return;
        del.disabled = true;
        try { await api('/comments/' + encodeURIComponent(c.id), { method:'DELETE' }); row.remove(); setCount(total - 1); sync(); }
        catch(e){ del.disabled = false; flash(commentError(e)); }
      };
      acts.append(del);
    } else if(signedIn){
      const rep = btn(t('Report', '举报'), ''); rep.onclick = async () => {
        rep.disabled = true;
        try { await api('/comments/' + encodeURIComponent(c.id) + '/report', { method:'POST', body:{} }); rep.textContent = t('Reported', '已举报'); }
        catch(e){ rep.disabled = false; flash(commentError(e)); }
      };
      acts.append(rep);
    }
    main.append(meta, el('div', 'body', c.body), acts);      // body as TEXT, always
    row.append(avatar(c.author), main);
    return row;
  }

  const err = el('div', 'err'); err.style.display = 'none';
  const flash = m => { err.textContent = m; err.style.display = ''; };
  const setCount = n => { total = Math.max(0, n); counts.set(key, total); };

  async function load(){
    more.disabled = true; err.style.display = 'none';
    try {
      const r = await api(`/comments?key=${encodeURIComponent(key)}&limit=20` + (next ? '&cursor=' + encodeURIComponent(next) : ''));
      if(!root.isConnected) return;
      for(const c of r.comments) list.append(item(c));
      next = r.next; setCount(r.count); loaded = true; status.textContent = '';
      more.style.display = next ? '' : 'none';
    } catch(e){ status.textContent = ''; flash(t('Couldn’t load comments — ', '无法加载评论。') + commentError(e)); }
    more.disabled = false; sync();
  }
  more.onclick = load;
  root.append(gate, list, status, more, err);

  if(signedIn){
    const ta = document.createElement('textarea');
    ta.maxLength = MAX; ta.placeholder = t('Share an idea — not the route…', '分享思路，把路线留给其他玩家发现…'); ta.setAttribute('aria-label', t('Write a comment', '写评论'));
    const cnt = el('div', 'cnt', `0 / ${MAX}`);
    ta.oninput = () => { cnt.textContent = `${ta.value.length} / ${MAX}`; };
    const post = btn(t('Post', '发表'), 'btn primary');
    post.onclick = async () => {
      if(!ta.value.trim()) return;
      post.disabled = true; err.style.display = 'none';
      try {
        const r = await api('/comments', { method:'POST', body:{ key, body:ta.value } });
        list.prepend(item(r.comment)); setCount(total + 1);
        ta.value = ''; cnt.textContent = `0 / ${MAX}`;
        track('comment_post');   // hook(analytics)
        sync();
      } catch(e){ flash(commentError(e)); }
      post.disabled = false;
    };
    const row = el('div', 'row'); row.append(post);
    root.append(ta, cnt, el('div', 'note', t('Plain text. No links, and no routes — they’re earned in Klarbase.', '请使用纯文本，不要发布链接或完整路线，让其他玩家也能享受解谜的乐趣。')), row);
  } else {
    const si = btn(t('Sign in to comment', '登录后发表评论'), 'btn primary');
    si.onclick = () => { if(opts.onSignIn) opts.onSignIn(); };
    const row = el('div', 'row'); row.append(si);
    root.append(row);
  }
  const close = btn(t('Close', '关闭'), 'btn ghost'); close.onclick = () => opts.modal.close();
  const crow = el('div', 'row'); crow.append(close); root.append(crow);
  load();
}
