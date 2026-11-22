import { createAuth } from '../_lib/auth.js';
import { createGitHubStore } from '../_lib/github-store.js';
import { HttpError, json } from '../_lib/http.js';
import { routeIsles } from '../_lib/isles.js';
import { routeProgress } from '../_lib/progress.js';

const safeMethod = method => method === 'GET' || method === 'HEAD';

async function getBundledKeys(request, env) {
  const response = await env.ASSETS.fetch(new URL('/isle-index.json', request.url));
  if(!response.ok) throw new HttpError(503, 'Bundled isle index unavailable');
  return new Set(await response.json());
}

async function verifyPuzzle(puzzle, env) {
  try {
    const namespace = env.ISLE_VERIFIER;
    const stub = namespace.get(namespace.idFromName('klarbase-isle-verifier'));
    const response = await stub.fetch('https://isles.internal/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(puzzle),
    });
    if(response.ok) return await response.json();
  } catch {}
  throw new HttpError(503, 'Isle verifier is unavailable');
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const isAuth = url.pathname.startsWith('/api/auth/');
  const isIsles = /^\/api\/(?:comments|puzzles)(?:\/|$)/.test(url.pathname);
  try {
    if(!env.GITHUB_DATA_REPOSITORY) {
      if(url.pathname === '/api/auth/providers' && request.method === 'GET') return json({ providers: [] });
      return json({ error: 'The Brclio static edition has no game API.' }, 404);
    }
    if(url.pathname === '/api/health' && request.method === 'GET') {
      createGitHubStore(env);
      return json({ ok: true, storage: 'github', verifier: !!env.ISLE_VERIFIER });
    }
    if(!isAuth && !isIsles && url.pathname !== '/api/progress') return json({ error: 'not found' }, 404);
    if(!safeMethod(request.method) && request.headers.get('Origin') !== url.origin) {
      throw new HttpError(403, 'request origin does not match');
    }

    const store = createGitHubStore(env);
    const auth = createAuth(env, store);
    if(isAuth) return await auth.handle(request);
    const user = await auth.getUser(request);
    if(url.pathname === '/api/progress') return await routeProgress(request, { store, user });

    const bundledKeys = url.pathname.startsWith('/api/comments') ? await getBundledKeys(request, env) : new Set();
    return await routeIsles(request, { store, user, bundledKeys, verifyPuzzle: puzzle => verifyPuzzle(puzzle, env) })
      || json({ error: 'not found' }, 404);
  } catch(error) {
    if(error instanceof HttpError) return json({ error: error.message }, error.status);
    if(error?.status === 503) return json({ error: 'Game storage temporarily unavailable' }, 503);
    console.error('Klarbase API request failed', { name: error?.name, path: url.pathname.split('/').slice(0, 3).join('/') });
    return json({ error: 'server error' }, 500);
  }
}
