import assert from 'node:assert/strict';
import { test } from 'node:test';
import { KlarbaseVerifier } from '../../cloudflare/verifier.js';
import { createAuth } from '../../functions/_lib/auth.js';
import { routeProgress } from '../../functions/_lib/progress.js';

const origin = 'https://klarbase.brclio.com';
const env = { AUTH_GITHUB_CLIENT_ID:'test-client', AUTH_GITHUB_CLIENT_SECRET:'test-secret' };
const api = (endpoint, init) => new Request(origin + '/api/auth' + endpoint, init);
const cookiePair = value => value.split(';', 1)[0];

function makeStore() {
  let records = new Map();
  const get = async key => records.get(key) ?? null;
  let previous = Promise.resolve();
  return {
    get records() { return records; }, get, read:fn => fn({ get }),
    mutate(update) {
      const commit = previous.then(async () => {
        const next = new Map(records);
        const result = await update({ get:async k => next.get(k) ?? null, set:next.set.bind(next), delete:next.delete.bind(next) });
        records = next;
        return result;
      });
      previous = commit.catch(() => {});
      return commit;
    },
  };
}

function emailEnv() {
  const objects = new Map();
  return {
    GITHUB_DATA_ENCRYPTION_KEY:Buffer.alloc(32, 29).toString('base64'),
    ISLE_VERIFIER:{
      idFromName:name => name,
      get(id) {
        if(!objects.has(id)) {
          const values = new Map();
          const storage = {
            get:async key => values.get(key), put:async (k, v) => values.set(k, v),
            setAlarm:async () => {}, deleteAll:async () => values.clear(),
          };
          const object = new KlarbaseVerifier({ storage });
          objects.set(id, { fetch:(url, options) => object.fetch(new Request(url, options)) });
        }
        return objects.get(id);
      },
    },
  };
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
  const auth = createAuth({ ...env, ...emailEnv() }, store);
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

  const signup = await auth.handle(emailRequest('/sign-up/email', { ...player, name:user.name }));
  const emailCookie = loginCookie(signup);
  const emailUser = await auth.getUser(api('/get-session', { headers:{ Cookie:emailCookie } }));
  assert.notEqual(emailUser.id, user.id);
  assert.equal(provider.mock.callCount(), 2);
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

const player = { name:'小岛玩家', email:'pip@example.test', password:'Many cozy floating isles' };
function emailRequest(endpoint, body, headers = {}) {
  return api(endpoint, {
    method:'POST', headers:{ Origin:origin, 'Content-Type':'application/json', ...headers }, body:JSON.stringify(body),
  });
}

function loginCookie(response) {
  assert.equal(response.status, 200);
  const header = response.headers.get('set-cookie');
  assert.match(header, /^__Host-klarbase-session=[a-f0-9]{64}\.[\w-]{43}; .*HttpOnly; SameSite=Lax; Secure$/);
  return cookiePair(header);
}

test('email signup works without OAuth, and a fresh login restores only its own cloud save', async () => {
  const store = makeStore();
  const auth = createAuth(emailEnv(), store);
  assert.deepEqual(await (await auth.handle(api('/providers'))).json(), { providers:['email'] });
  const signup = await auth.handle(emailRequest('/sign-up/email', { ...player, email:'  PIP@example.test ' }));
  const firstCookie = loginCookie(signup);
  const { user } = await signup.json();
  assert.deepEqual(user, { id:user.id, name:player.name, image:null });
  const sessionRequest = cookie => api('/get-session', { headers:{ Cookie:cookie } });
  const session = await (await auth.handle(sessionRequest(firstCookie))).json();
  assert.deepEqual(session.user, user);
  assert.ok(Date.parse(session.session.expiresAt) > Date.now());

  async function progress(cookie, expectedId, data) {
    const request = new Request(origin + '/api/progress', {
      method:data ? 'PUT' : 'GET',
      headers:{ Cookie:cookie, 'X-Klarbase-Account':expectedId, 'Content-Type':'application/json' },
      body:data && JSON.stringify({ data }),
    });
    return routeProgress(request, { store, user:await auth.getUser(request) });
  }
  const clear = { progress:{ 'o:first-steps':{ stars:3, moves:6 } } };
  assert.equal((await progress(firstCookie, user.id, clear)).status, 200);
  await auth.handle(api('/sign-out', { method:'POST', headers:{ Origin:origin, Cookie:firstCookie } }));
  await assert.rejects(progress(firstCookie, user.id), { status:401 });

  const returning = await auth.handle(emailRequest('/sign-in/email', { email:player.email, password:player.password }));
  const freshCookie = loginCookie(returning);
  assert.notEqual(freshCookie, firstCookie);
  assert.deepEqual((await returning.json()).user, user);
  assert.deepEqual((await (await progress(freshCookie, user.id)).json()).data.progress, clear.progress);

  const other = await auth.handle(emailRequest('/sign-up/email', { ...player, email:'other@example.test' }));
  const otherCookie = loginCookie(other);
  const otherId = (await other.json()).user.id;
  assert.notEqual(otherId, user.id);
  assert.deepEqual(await (await progress(otherCookie, otherId)).json(), { data:null, updatedAt:null });
  await assert.rejects(progress(otherCookie, user.id, clear), { status:409 });
  assert.ok(!JSON.stringify([...store.records]).includes(player.password));
  assert.ok(![...store.records.keys()].some(key => key.includes('@')));
  const credentials = [...store.records].filter(([path]) => path.endsWith('/credential.json')).map(([, data]) => data);
  assert.equal(credentials.length, 2);
  assert.notEqual(credentials[0].salt, credentials[1].salt);
  assert.notEqual(credentials[0].hash, credentials[1].hash);
});

test('two registrations for the same normalized email can create only one account', async () => {
  const auth = createAuth(emailEnv(), makeStore());
  const accounts = [player, { ...player, name:'Another name', email:player.email.toUpperCase(), password:'Different cozy isles' }];
  const responses = await Promise.all(accounts.map(data => auth.handle(emailRequest('/sign-up/email', data))));
  const winner = responses.findIndex(res => res.status === 200);
  assert.ok(winner >= 0);
  assert.equal(responses[1 - winner].status, 422);
  assert.equal(responses[1 - winner].headers.get('set-cookie'), null);
  const expected = (await responses[winner].json()).user;

  const success = await auth.handle(emailRequest('/sign-in/email', accounts[winner]));
  assert.deepEqual((await success.json()).user, expected);
  const wrong = await auth.handle(emailRequest('/sign-in/email', accounts[1 - winner]));
  const unknown = await auth.handle(emailRequest('/sign-in/email', { ...player, email:'unknown@example.test' }));
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.equal(wrong.headers.get('set-cookie'), null);
  assert.deepEqual(await wrong.json(), await unknown.json());
});

test('email signup rejects malformed identifiers, names, and out-of-range passwords', async () => {
  const auth = createAuth(emailEnv(), makeStore());
  for(const change of [{ email:'bad' }, { name:' ' }, { name:'x'.repeat(81) },
    { password:'p'.repeat(9) }, { password:'p'.repeat(129) }]) {
    const rejected = await auth.handle(emailRequest('/sign-up/email', { ...player, ...change }));
    assert.equal(rejected.status, 400);
    assert.equal(rejected.headers.get('set-cookie'), null);
  }
});

test('repeated sign-ins for one address are throttled and resume after the window', async t => {
  const auth = createAuth(emailEnv(), makeStore());
  const request = i => auth.handle(emailRequest('/sign-in/email', player, { 'CF-Connecting-IP':'192.0.2.' + i }));
  const now = Date.now();
  const clock = t.mock.method(Date, 'now', () => now);
  for(let i = 1; i <= 10; i++) assert.equal((await request(i)).status, 401);
  const blocked = await request(11);
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get('set-cookie'), null);
  clock.mock.mockImplementation(() => now + 10 * 60 * 1000 + 1);
  assert.equal((await request(12)).status, 401);
});
