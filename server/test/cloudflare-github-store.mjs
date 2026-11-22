import assert from 'node:assert/strict';
import { createCipheriv, generateKeyPairSync, randomBytes, verify } from 'node:crypto';
import test from 'node:test';
import { createGitHubStore } from '../../functions/_lib/github-store.js';

const repository = 'test-owner/isle-data';
const installation = '1234';
const record = 'users/ab/test/save/progress.json';
const daily = 'users/ab/test/save/dailies.json';
const key = randomBytes(32);
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength:2048 });
const env = {
  GITHUB_APP_ID:'Iv23testClientId', GITHUB_APP_INSTALLATION_ID:installation,
  GITHUB_APP_PRIVATE_KEY:privateKey.export({ format:'pem', type:'pkcs1' }),
  GITHUB_DATA_REPOSITORY:repository, GITHUB_DATA_ENCRYPTION_KEY:key.toString('base64'),
};

// Produce the v1 format independently, as if the record came from an older deployment.
function legacyEnvelope(path, value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(path));
  const bytes = Buffer.concat([iv, cipher.update(JSON.stringify(value)), cipher.final(), cipher.getAuthTag()]);
  return JSON.stringify({ version:1, data:bytes.toString('base64') });
}

test('reads existing encrypted records and replays a split-file save on a competing commit', async () => {
  let head = 'first', conflicts = 0, authCalls = 0;
  const files = new Map([
    ['first', new Map([[record, legacyEnvelope(record, { a:1 })]])],
    ['second', new Map([[record, legacyEnvelope(record, { a:1, otherDevice:2 })]])],
  ]);
  const parents = new Map();
  const mockGitHub = async (url, { method, body, headers }) => {
    const { pathname, searchParams } = new URL(url);
    const payload = body && JSON.parse(body);
    if (pathname === '/app/installations/' + installation + '/access_tokens') {
      authCalls++;
      const [header, claims, sig] = headers.authorization.slice(7).split('.');
      assert.equal(JSON.parse(Buffer.from(claims, 'base64url')).iss, env.GITHUB_APP_ID);
      assert.ok(verify('RSA-SHA256', Buffer.from(header + '.' + claims), publicKey, Buffer.from(sig, 'base64url')));
      assert.deepEqual(payload, { repositories:['isle-data'], permissions:{ contents:'write' } });
      return Response.json({ token:'installation-token', expires_at:new Date(Date.now() + 3600000).toISOString() });
    }
    assert.equal(headers.authorization, 'Bearer installation-token');
    assert.ok(pathname.startsWith('/repos/' + repository + '/'));
    const path = pathname.slice(('/repos/' + repository).length);
    if (path === '/git/ref/heads/main') return Response.json({ object:{ sha:head } });
    if (path.startsWith('/contents/data/')) {
      const ref = searchParams.get('ref'), name = path.slice('/contents/data/'.length);
      const content = files.get(ref === 'main' ? head : ref).get(name);
      return content ? Response.json({ type:'file', encoding:'base64', content:Buffer.from(content).toString('base64') })
        : new Response(null, { status:404 });
    }
    if (method === 'GET' && path.startsWith('/git/commits/')) {
      return Response.json({ tree:{ sha:path.slice('/git/commits/'.length) } });
    }
    if (path === '/git/trees' && method === 'POST') {
      const next = new Map(files.get(payload.base_tree));
      assert.deepEqual(payload.tree.map(entry => entry.path), ['data/' + record, 'data/' + daily]);
      for (const entry of payload.tree) {
        assert.deepEqual(Object.keys(JSON.parse(entry.content)).sort(), ['data', 'version']);
        next.set(entry.path.slice('data/'.length), entry.content);
      }
      const tree = payload.base_tree + '-tree';
      files.set(tree, next);
      return Response.json({ sha:tree });
    }
    if (path === '/git/commits' && method === 'POST') {
      const sha = payload.tree + '-commit';
      files.set(sha, files.get(payload.tree));
      parents.set(sha, payload.parents);
      return Response.json({ sha });
    }
    if (path === '/git/refs/heads/main' && method === 'PATCH') {
      assert.equal(payload.force, false);
      if (head === 'first') head = 'second'; // a different device committed between read and write
      if (parents.get(payload.sha)[0] !== head) {
        conflicts++;
        return new Response(null, { status:422 });
      }
      head = payload.sha;
      return Response.json({});
    }
    throw new Error('Unexpected GitHub request');
  };
  const store = createGitHubStore(env, mockGitHub);
  assert.deepEqual(await store.get(record), { a:1 });
  await store.mutate(async tx => {
    tx.set(record, { ...await tx.get(record), thisDevice:3 });
    tx.set(daily, { stars:2 });
  });
  assert.equal(conflicts, 1);
  assert.equal(authCalls, 1);
  assert.deepEqual(await store.get(record), { a:1, otherDevice:2, thisDevice:3 });
  assert.deepEqual(await store.get(daily), { stars:2 });
  assert.ok(createGitHubStore({ ...env, GITHUB_APP_ID:'1234' }, mockGitHub));
});
