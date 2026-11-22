import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequest } from '../../functions/api/[[path]].js';
import { KlarbaseVerifier } from '../../cloudflare/verifier.js';

const origin = 'https://klarbase.brclio.com';
const env = {
  AUTH_ORIGIN: origin,
  AUTH_GITHUB_CLIENT_ID: 'test-client',
  AUTH_GITHUB_CLIENT_SECRET: 'test-secret',
  GITHUB_DATA_REPOSITORY: 'fixture/data',
  GITHUB_APP_ID: '1',
  GITHUB_APP_INSTALLATION_ID: '1',
  GITHUB_APP_PRIVATE_KEY: 'unused-test-key',
  GITHUB_DATA_ENCRYPTION_KEY: Buffer.alloc(32, 29).toString('base64'),
  ISLE_VERIFIER: {},
};

const api = (path, options) => onRequest({ request: new Request(origin + '/api' + path, options), env });

test('Pages serves the game API and protects guest progress', async () => {
  const health = await api('/health');
  assert.equal(health.status, 200);
  assert.match(health.headers.get('content-type'), /^application\/json\b/);
  assert.deepEqual(await health.json(), { ok: true, storage: 'github', verifier: true });

  const progress = await api('/progress');
  assert.equal(progress.status, 401);
  assert.equal((await progress.json()).error, 'login required');
});

test('Pages starts GitHub sign-in on the production callback', async () => {
  const response = await api('/auth/sign-in/social', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'github', callbackURL: '/create' }),
  });
  assert.equal(response.status, 200);
  const { url, redirect } = await response.json();
  const target = new URL(url);
  assert.equal(redirect, true);
  assert.equal(target.origin + target.pathname, 'https://github.com/login/oauth/authorize');
  assert.equal(target.searchParams.get('client_id'), env.AUTH_GITHUB_CLIENT_ID);
  assert.equal(target.searchParams.get('redirect_uri'), origin + '/api/auth/callback/github');
});

test('Pages advertises email signup on the canonical API and protects both credential endpoints', async () => {
  const providers = await api('/auth/providers');
  assert.deepEqual((await providers.json()).providers.sort(), ['email', 'github']);
  for(const hostEnv of [{}, env]) {
    const response = await onRequest({ env:hostEnv, request:new Request('https://preview.example/api/auth/providers') });
    assert.deepEqual(await response.json(), { providers:[] });
  }
  for(const endpoint of ['/auth/sign-up/email', '/auth/sign-in/email']) {
    const body = { method:'POST', body:'{}' };
    const blocked = await api(endpoint, { ...body, headers:{ Origin:'https://other.example', 'Content-Type':'application/json' } });
    assert.equal(blocked.status, 403);
    const invalidType = await api(endpoint, { ...body, headers:{ Origin:origin, 'Content-Type':'text/plain' } });
    assert.equal(invalidType.status, 415);
    const oversized = await api(endpoint, { method:'POST', headers:{ Origin:origin, 'Content-Type':'application/json' },
      body:JSON.stringify({ name:'a'.repeat(20000) }) });
    assert.equal(oversized.status, 413);
  }
});

test('the verifier solves a submitted isle and rejects an unreachable goal', async () => {
  const verifier = new KlarbaseVerifier();
  async function verify(row) {
    const response = await verifier.fetch(new Request('https://isles.internal/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schemaVersion: 5, theme: 'jungle', rows: [row], par: 99 }),
    }));
    assert.equal(response.status, 200);
    return response.json();
  }
  const solved = await verify('S G');
  assert.match(solved.hash, /^[0-9a-f]{64}$/);
  assert.equal(solved.puzzle.par, 1);
  const invalid = await verify('S # G');
  assert.equal(invalid.errors[0].code, 'E_UNSOLVABLE');
  assert.equal(invalid.puzzle, undefined);
});
