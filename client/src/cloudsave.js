// Cloud save — signed-in players keep their progress on every device.
// Only PROGRESS syncs (see core/src/progress.js): per-isle stars/best moves/best
// time, dailies, and map state. GitHub sign-in uses a browser cache for each account.
// Settings, sound, timer, builder draft, effort and sign-in preferences stay on the device.
// Local and remote are combined by the same mergeProgress the server runs, so a save
// can only gain. Everything here is silent on failure and a no-op when signed out.
import { mergeProgress } from '@klar/core';
import { GITHUB_DEPLOYMENT } from './deployment.js';
import { api } from './net.js';
import { accountForProgress, readProgress, selectProgressAccount, writeProgress } from './progress-storage.js';

const warn = (...a) => { if(import.meta.env?.DEV) console.warn('[cloudsave]', ...a); };

let ctx = null, signedIn = false, account = null, generation = 0, timer = 0, pendingPush;

// main.js hands over the live progress/dailies objects (mutated in place — the game holds
// references to them) plus a toast and a re-render callback.   hook(cloudsave)
export function initCloudSave(c){ ctx = c; }

function local(){
  const map = readProgress('map');
  return { v:1, progress:ctx.progress, dailies:ctx.dailies, ...(map ? { map } : {}) };
}

function replace(target, source){
  for(const key of Object.keys(target)) delete target[key];
  Object.assign(target, source);
}

function changeAccount(nextAccount){
  const view = ctx?.beforeScopeChange?.();
  account = nextAccount;
  selectProgressAccount(account);
  if(!ctx) return;
  for(const kind of ['progress', 'dailies']) replace(ctx[kind], readProgress(kind, {}));
  ctx.afterScopeChange?.(view);
  ctx.refresh();
}

function requestProgress(expectedAccount, options = {}){
  if(expectedAccount){
    // Tabs share the sign-in cookie. The expected account belongs to this tab's local save.
    options.headers = { 'x-klarbase-account':expectedAccount, ...(options.body ? { 'content-type':'application/json' } : {}) };
  }
  return api('/progress', options);
}

// write a merged save back into the live objects + localStorage; true when something changed
function apply(merged){
  const before = JSON.stringify(mergeProgress(local(), {}));
  if(JSON.stringify(merged) === before) return false;
  for(const kind of ['progress', 'dailies']){
    replace(ctx[kind], merged[kind]);
    writeProgress(kind, ctx[kind]);
  }
  if(merged.map){ writeProgress('map', merged.map); window.dispatchEvent(new CustomEvent('klarbase:map', { detail:merged.map })); }
  return true;
}

// After sign-in: restore the local account cache, then merge it with the cloud.
export async function syncOnSignIn(session){
  const expectedAccount = accountForProgress(session);
  const nextSignedIn = GITHUB_DEPLOYMENT ? !!expectedAccount : !!session;
  if(nextSignedIn !== signedIn || expectedAccount !== account){
    clearTimeout(timer); timer = 0; pendingPush = undefined;
    generation++;
  }
  signedIn = nextSignedIn;
  if(expectedAccount !== account) changeAccount(expectedAccount);
  if(!signedIn || !ctx) return;
  const current = generation;
  try {
    const { data } = await requestProgress(expectedAccount);
    if(current !== generation) return;
    const merged = mergeProgress(local(), data);
    const changed = apply(merged);
    if(!GITHUB_DEPLOYMENT || JSON.stringify(merged) !== JSON.stringify(mergeProgress(data, {}))){
      const r = await requestProgress(expectedAccount, { method:'PUT', body:{ data:merged } });
      if(current !== generation) return;
      if(r?.data) apply(mergeProgress(local(), r.data));
    }
    if(changed) ctx.refresh();
    let seen = false;
    const toastKey = expectedAccount ? `klarbase.cloudToast.${expectedAccount}` : 'klarbase.cloudToast';
    try { seen = sessionStorage.getItem(toastKey) === '1'; sessionStorage.setItem(toastKey, '1'); } catch {}
    if(!seen) ctx.toast('Progress saved to your account ✓');
  } catch(e){ warn('sync failed', e); }
}

// after a clear: save to the account five seconds after the last one
export function pushSoon(){
  if(!signedIn || !ctx) return;
  clearTimeout(timer); timer = setTimeout(push, 5000);
}
function push(keepalive = false){
  timer = 0;
  if(!signedIn || !ctx) return;
  const request = pushProgress(generation, account, keepalive);
  pendingPush = request;
  request.finally(() => { if(pendingPush === request) pendingPush = undefined; });
  return request;
}
async function pushProgress(current, expectedAccount, keepalive){
  try {
    const r = await requestProgress(expectedAccount, { method:'PUT', body:{ data:local() }, keepalive });
    if(current === generation && r?.data) apply(mergeProgress(local(), r.data));
  } catch(e){ warn('push failed', e); }
}
export async function flushCloudSave(){
  if(timer){ clearTimeout(timer); await push(); }
  else await pendingPush;
}
// don't lose a pending push when the tab is hidden or closed
document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'hidden' && timer){ clearTimeout(timer); push(true); } });
