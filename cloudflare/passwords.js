import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { HttpError, json, readJson } from '../functions/_lib/http.js';

const WINDOW = 10 * 60 * 1000;
const quotas = { 'signup-ip':30, 'signin-ip':60, 'signin-account':10 };
const scryptOptions = { N:16384, r:8, p:5, maxmem:32 * 1024 * 1024 };

// Every quota has a separate named object. Storage input gates serialize the
// read/update, including concurrent requests handled by different Pages isolates.
async function consume(storage, limit) {
  const now = Date.now();
  const previous = await storage.get('attempts');
  const active = previous?.until > now;
  const state = active ? previous : { count:0, until:now + WINDOW };
  if(state.count >= limit) return json({ error:'Too many attempts' }, 429);
  state.count++;
  await Promise.all([storage.put('attempts', state), active ? undefined : storage.setAlarm(state.until)]);
  return json({ ok:true });
}

export async function clearExpiredAttempts(storage) {
  const state = await storage.get('attempts');
  if(state && state.until <= Date.now()) await storage.deleteAll();
}

export async function handlePasswordService(request, pathname, storage) {
  if(request.method !== 'POST') return json({ error:'method not allowed' }, 405, { Allow:'POST' });
  if(pathname.startsWith('/limit/')) {
    const scope = pathname.slice('/limit/'.length);
    if(Object.hasOwn(quotas, scope)) return consume(storage, quotas[scope]);
  }
  if(pathname !== '/password') return json({ error:'not found' }, 404);
  const { password, credential } = await readJson(request, 4096);
  if(typeof password !== 'string' || password.length < 10 || password.length > 128) throw new HttpError(400, 'Invalid password length');
  // A null credential also performs a full derivation for unknown addresses.
  if(credential === null) {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, Buffer.from(salt, 'hex'), 32, scryptOptions).toString('hex');
    return json({ credential:{ scheme:'scrypt-v1', salt, hash } });
  }
  if(credential?.scheme !== 'scrypt-v1' || !/^[a-f0-9]{32}$/.test(credential.salt) || !/^[a-f0-9]{64}$/.test(credential.hash)) {
    throw new HttpError(503, 'Invalid credential record');
  }
  const derived = scryptSync(password, Buffer.from(credential.salt, 'hex'), 32, scryptOptions);
  return json({ valid:timingSafeEqual(derived, Buffer.from(credential.hash, 'hex')) });
}
