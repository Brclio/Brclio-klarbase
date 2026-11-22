import { GITHUB_DEPLOYMENT } from './deployment.js';

let account = null;

export function accountForProgress(session) {
  const id = session?.user?.id;
  return GITHUB_DEPLOYMENT && typeof id === 'string' && /^[0-9a-f]{64}$/.test(id) ? id : null;
}

export function selectProgressAccount(id) { account = id; }

function key(kind) {
  return account ? `klarbase.v2.account.${account}.${kind}` : `klarbase.v2.${kind}`;
}

export function readProgress(kind, fallback = null) {
  try { return JSON.parse(localStorage.getItem(key(kind))) ?? fallback; }
  catch { return fallback; }
}

export function writeProgress(kind, value) {
  try { localStorage.setItem(key(kind), JSON.stringify(value)); }
  catch {}
}
