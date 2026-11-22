import { HttpError, readJson } from './http.js';

const encoder = new TextEncoder();
const emailPattern = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

// Use a distinct HMAC key for lookups. Public author IDs and Git paths must not
// let someone test a guessed email address without the storage secret.
async function identityKey(secret) {
  let bytes;
  try { bytes = Uint8Array.from(atob(secret.trim()), char => char.charCodeAt(0)); } catch {}
  if(bytes?.length !== 32) throw new HttpError(503, 'Email sign-in temporarily unavailable');
  const material = await crypto.subtle.importKey('raw', bytes, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({
    name:'HKDF', hash:'SHA-256', salt:encoder.encode('Klarbase'), info:encoder.encode('email account identifiers v1'),
  }, material, { name:'HMAC', hash:'SHA-256', length:256 }, false, ['sign']);
}

async function identifier(key, kind, value) {
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(kind + ':' + value));
  return Array.from(new Uint8Array(mac), byte => byte.toString(16).padStart(2, '0')).join('');
}

// All password work and attempt counters run inside the private Worker binding.
// Pages Free has a much smaller CPU allowance than a Durable Object invocation.
async function service(namespace, shard, path, body) {
  try {
    const stub = namespace.get(namespace.idFromName(shard));
    const response = await stub.fetch('https://auth.internal/' + path, {
      method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(body),
    });
    if(response.status === 429) throw new HttpError(429, 'Too many attempts. Try again later.');
    if(response.ok) return await response.json();
  } catch(error) {
    if(error instanceof HttpError) throw error;
  }
  throw new HttpError(503, 'Email sign-in temporarily unavailable');
}

export async function prepareEmail(request, env, register) {
  const body = await readJson(request, 4096);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const local = email.split('@', 1)[0];
  if(email.length > 254 || !emailPattern.test(email) || local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..')) {
    throw new HttpError(400, 'Invalid email address');
  }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if(register && (!name || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name))) throw new HttpError(400, 'Invalid display name');
  const password = body.password;
  if(typeof password !== 'string' || password.length < 10 || password.length > 128) throw new HttpError(400, 'Invalid password length');

  const key = await identityKey(env.GITHUB_DATA_ENCRYPTION_KEY);
  const id = await identifier(key, 'email', email);
  const ip = await identifier(key, 'address', request.headers.get('CF-Connecting-IP') || 'local');
  const ns = env.ISLE_VERIFIER;
  const action = register ? 'signup-ip' : 'signin-ip';
  await service(ns, action + '-' + ip, 'limit/' + action, {});
  if(!register) await service(ns, 'signin-account-' + id, 'limit/signin-account', {});
  return { id, name, passwordWork:credential => service(ns, 'password-' + id, 'password', { password, credential }) };
}
