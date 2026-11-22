import { GITHUB_DEPLOYMENT } from './deployment.js';

let account = null;

export function accountForProgress(session) {
  const id = session?.user?.id;
  // Existing Express OAuth users retain their original unscoped progress cache.
  const scopedId = GITHUB_DEPLOYMENT ? /^[0-9a-f]{64}$/ : /^email_[0-9a-f]{32}$/;
  return typeof id === 'string' && scopedId.test(id) ? id : null;
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
