import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAuth } from '../../functions/_lib/auth.js';

const origin = 'https://klarbase.brclio.com';
const env = { AUTH_GITHUB_CLIENT_ID:'test-client', AUTH_GITHUB_CLIENT_SECRET:'test-secret' };
const api = (endpoint, init) => new Request(origin + '/api/auth' + endpoint, init);
const cookiePair = value => value.split(';', 1)[0];

function makeStore() {
  const records = new Map();
  const tx = { get:async key => records.get(key), set:records.set.bind(records), delete:records.delete.bind(records) };
  return { records, get:tx.get, mutate:async update => update(tx) };
}

async function start(auth, callbackURL = '/create') {
  const res = await auth.handle(api('/sign-in/social', {
    method:'POST', headers:{ Origin:origin, 'Content-Type':'application/json' },
    body:JSON.stringify({ provider:'github', callbackURL }),
  }));
  assert.equal(res.status, 200);
  const cookie = res.headers.get('set-cookie');
  assert.match(cookie, /^__Host-klarbase-oauth=.*; HttpOnly; SameSite=Lax; Secure$/);
  const url = new URL((await res.json()).url);
  assert.equal(url.origin, 'https://github.com');
  assert.equal(url.searchParams.get('redirect_uri'), origin + '/api/auth/callback/github');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  return { state:url.searchParams.get('state'), challenge:url.searchParams.get('code_challenge'), cookie:cookiePair(cookie) };
}

test('guards provider availability and same-origin writes', async () => {
  const auth = createAuth(env, makeStore());
  assert.deepEqual(await (await auth.handle(api('/providers'))).json(), { providers:['github'] });
  const other = new Request('https://brclio-klarbase.pages.dev/api/auth/providers');
  assert.deepEqual(await (await auth.handle(other)).json(), { providers:[] });
  const bad = await auth.handle(api('/sign-in/social', {
    method:'POST', headers:{ Origin:'https://other.brclio.com', 'Content-Type':'application/json' },
    body:'{"provider":"github"}',
  }));
  assert.equal(bad.status, 403);
  const oversized = api('/sign-in/social', {
    method:'POST', headers:{ Origin:origin, 'Content-Type':'application/json' },
    body:JSON.stringify({ provider:'github', callbackURL:'a'.repeat(1024) }),
  });
  await assert.rejects(auth.handle(oversized), { status:413 });
  assert.equal(await auth.getUser(api('/get-session')), null);
});

test('per-account profile and revocable hashed session after valid OAuth', async t => {
  const store = makeStore();
  const auth = createAuth(env, store);
  const flow = await start(auth);
  const provider = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(options.redirect, 'manual');
    if(url === 'https://github.com/login/oauth/access_token') {
      const body = options.body;
      assert.equal(body.get('code'), 'test-code');
      assert.equal(body.get('client_secret'), env.AUTH_GITHUB_CLIENT_SECRET);
      assert.equal(body.get('redirect_uri'), origin + '/api/auth/callback/github');
      const verifier = new TextEncoder().encode(body.get('code_verifier'));
      const digest = await crypto.subtle.digest('SHA-256', verifier);
      assert.equal(Buffer.from(digest).toString('base64url'), flow.challenge);
      return Response.json({ access_token:'temporary-provider-token' });
    }
    assert.equal(url, 'https://api.github.com/user');
    assert.equal(options.headers.Authorization, 'Bearer temporary-provider-token');
    return Response.json({ id:44, login:'test-player', name:'Test Player', avatar_url:'https://avatars.githubusercontent.com/u/44' });
  });
  const callback = state => api('/callback/github?code=test-code&state=' + state, { headers:{ Cookie:flow.cookie } });
  assert.equal((await auth.handle(callback('invalid'))).headers.get('location'), '/?sign-in=failed');
  const denied = api('/callback/github?error=access_denied&state=' + flow.state, { headers:{ Cookie:flow.cookie } });
  assert.equal((await auth.handle(denied)).headers.get('location'), '/?sign-in=cancelled');
  assert.equal(provider.mock.callCount(), 0);
  const finish = await auth.handle(callback(flow.state));
  assert.equal(finish.status, 303);
  assert.equal(finish.headers.get('location'), '/create');
  assert.equal(finish.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(provider.mock.callCount(), 2);
  const sessionCookie = cookiePair(finish.headers.getSetCookie().find(value => value.startsWith('__Host-klarbase-session=')));
  const token = sessionCookie.split('.')[1];
  assert.equal(store.records.size, 2);
  const user = await auth.getUser(api('/get-session', { headers:{ Cookie:sessionCookie } }));
  assert.equal(user.name, 'Test Player');
  assert.equal(user.image, 'https://avatars.githubusercontent.com/u/44');
  assert.ok([...store.records.keys()].every(path => path.startsWith('users/' + user.id.slice(0, 2) + '/' + user.id + '/')));
  assert.doesNotMatch(JSON.stringify([...store.records]), new RegExp(token + '|temporary-provider-token|test-secret'));
  assert.equal(await auth.getUser(api('/get-session', { headers:{ Cookie:sessionCookie.slice(0, -2) + 'aa' } })), null);
  const logout = await auth.handle(api('/sign-out', { method:'POST', headers:{ Origin:origin, Cookie:sessionCookie } }));
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal(await auth.getUser(api('/get-session', { headers:{ Cookie:sessionCookie } })), null);
  assert.equal(store.records.size, 1);
});

test('rejects redirect destinations that normalize to an external URL', async t => {
  let step = 0;
  t.mock.method(globalThis, 'fetch', async () => Response.json(step++ === 0
    ? { access_token:'test-token' }
    : { id:1, login:'test-player', avatar_url:'https://other.example/tracker' }));
  const auth = createAuth(env, makeStore());
  const flow = await start(auth, '/anything/..//other.example');
  const callback = api('/callback/github?code=code&state=' + flow.state, { headers:{ Cookie:flow.cookie } });
  assert.equal((await auth.handle(callback)).headers.get('location'), '/');
});
