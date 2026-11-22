import { json, readJson } from './http.js';

const API = '/api/auth';
const OAUTH_AGE = 10 * 60;
const SESSION_AGE = 7 * 24 * 60 * 60;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const random = () => base64url(crypto.getRandomValues(new Uint8Array(32)));
const TOKEN = /^[\w-]{43}$/;
const ID = /^[a-f0-9]{64}$/;

const PROVIDERS = {
  github: {
    authorize: 'https://github.com/login/oauth/authorize',
    token: 'https://github.com/login/oauth/access_token',
    profile: 'https://api.github.com/user',
    scopes: 'read:user',
    id: p => Number.isSafeInteger(p.id) && p.id > 0 ? String(p.id) : '',
    name: p => p.name || p.login,
    image: p => p.avatar_url,
    avatarHost: 'avatars.githubusercontent.com',
  },
  google: {
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    profile: 'https://openidconnect.googleapis.com/v1/userinfo',
    scopes: 'openid profile',
    id: p => p.sub,
    name: p => p.name,
    image: p => p.picture,
    avatarHost: 'lh3.googleusercontent.com',
  },
};

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/=+$/, '').replaceAll('+', '-').replaceAll('/', '_');
}

async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}

async function hexDigest(value) {
  return Array.from(await digest(value), byte => byte.toString(16).padStart(2, '0')).join('');
}

function readCookie(request, name) {
  const prefix = name + '=';
  const matches = (request.headers.get('cookie') || '').split(';').map(s => s.trim()).filter(s => s.startsWith(prefix));
  return matches.length === 1 ? matches[0].slice(prefix.length) : '';
}

function decodeState(value) {
  if(!/^[\w-]{1,2048}$/.test(value)) return null;
  try {
    return JSON.parse(decoder.decode(Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0))));
  } catch { return null; }
}

function safeReturn(value, origin) {
  if(typeof value !== 'string' || value.length > 450 || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/';
  try {
    const url = new URL(value, origin);
    if(url.origin === origin && !url.pathname.startsWith('//') && !/^\/api(?:\/|$)/.test(url.pathname)) return url.pathname + url.search + url.hash;
  } catch {}
  return '/';
}

function response(body, status = 200, cookie) {
  return json(body, status, cookie ? { 'Set-Cookie':cookie } : {});
}

function redirect(location, cookies) {
  const headers = new Headers({ Location:location, 'Cache-Control':'no-store', 'Referrer-Policy':'no-referrer' });
  for(const cookie of cookies) headers.append('Set-Cookie', cookie);
  return new Response(null, { status:303, headers });
}

const failure = (error, status) => response({ error }, status);
const userDir = id => `users/${id.slice(0, 2)}/${id}`;
const profilePath = id => `${userDir(id)}/profile.json`;
const sessionPath = (id, hash) => `${userDir(id)}/sessions/${hash}.json`;

function avatarUrl(value, host) {
  if(typeof value !== 'string' || value.length > 384) return null;
  try {
    const url = new URL(value);
    if(url.protocol === 'https:' && url.host === host && !url.username && !url.password) return url.href;
  } catch {}
  return null;
}

export function createAuth(env, store) {
  const origin = new URL(env.AUTH_ORIGIN || 'https://klarbase.brclio.com').origin;
  const secure = origin.startsWith('https:');
  if(!secure && !/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(origin)) throw new Error('Invalid Klarbase auth origin');
  const providers = Object.entries(PROVIDERS).filter(([name]) => env[`AUTH_${name.toUpperCase()}_CLIENT_ID`] && env[`AUTH_${name.toUpperCase()}_CLIENT_SECRET`]).map(([name]) => name);
  const configured = providers.length > 0;
  const cookieName = key => (secure ? '__Host-' : '') + 'klarbase-' + key;
  const cookie = (key, value, ttl) => `${cookieName(key)}=${value}; Path=/; Max-Age=${ttl}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
  const callback = name => origin + API + '/callback/' + name;

  async function sessionFile(request) {
    if(new URL(request.url).origin !== origin) return null;
    const parts = readCookie(request, cookieName('session')).split('.');
    if(parts.length !== 2 || !ID.test(parts[0]) || !TOKEN.test(parts[1])) return null;
    return { id:parts[0], path:sessionPath(parts[0], await hexDigest(parts[1])) };
  }

  async function readSession(request) {
    const file = await sessionFile(request);
    if(!file) return null;
    const session = await store.get(file.path);
    if(session?.userId !== file.id || !(Date.parse(session.expiresAt) > Date.now())) return null;
    const user = await store.get(profilePath(file.id));
    return user?.id === file.id ? { user:{ id:user.id, name:user.name, image:user.image }, session:{ expiresAt:session.expiresAt } } : null;
  }

  async function start(request) {
    const body = await readJson(request, 1024);
    const name = body.provider;
    if(!providers.includes(name)) return failure('Sign-in provider unavailable', 400);
    const state = random();
    const verifier = random();
    const returnTo = safeReturn(body.callbackURL, origin);
    const expires = Date.now() + OAUTH_AGE * 1000;
    const authorization = new URL(PROVIDERS[name].authorize);
    const clientId = env[`AUTH_${name.toUpperCase()}_CLIENT_ID`];
    // A GitHub App derives authorization from its settings and accepts no OAuth app scopes.
    if(name !== 'github' || !clientId.startsWith('Iv')) authorization.searchParams.set('scope', PROVIDERS[name].scopes);
    for(const [k, v] of Object.entries({ client_id:clientId, redirect_uri:callback(name), response_type:'code', state, code_challenge_method:'S256', code_challenge:base64url(await digest(verifier)) })) {
      authorization.searchParams.set(k, v);
    }
    const value = base64url(encoder.encode(JSON.stringify({ state, verifier, expires, returnTo, name })));
    return response({ url:authorization.href, redirect:true }, 200, cookie('oauth', value, OAUTH_AGE));
  }

  async function finish(request, url, name) {
    const flow = decodeState(readCookie(request, cookieName('oauth')));
    const expire = cookie('oauth', '', 0);
    const fail = (status = 'failed') => redirect(`/?sign-in=${status}`, [expire]);
    if(!providers.includes(name) || flow?.name !== name || !(flow.expires > Date.now()) || !TOKEN.test(flow.state || '') ||
      !TOKEN.test(flow.verifier || '') || url.searchParams.get('state') !== flow.state) return fail();
    if(url.searchParams.has('error')) return fail(url.searchParams.get('error') === 'access_denied' ? 'cancelled' : 'failed');
    const code = url.searchParams.get('code');
    if(!code || code.length > 1024) return fail();
    const provider = PROVIDERS[name];
    let profile;
    try {
      const exchange = await fetch(provider.token, {
        method:'POST',
        headers:{ Accept:'application/json', 'User-Agent':'Brclio-Klarbase' },
        body:new URLSearchParams({
          code, code_verifier:flow.verifier, grant_type:'authorization_code', redirect_uri:callback(name),
          client_id:env[`AUTH_${name.toUpperCase()}_CLIENT_ID`], client_secret:env[`AUTH_${name.toUpperCase()}_CLIENT_SECRET`],
        }),
        redirect:'error',
      });
      if(!exchange.ok) return fail();
      const data = await exchange.json();
      if(typeof data?.access_token !== 'string' || !data.access_token || data.access_token.length > 4096) return fail();
      const user = await fetch(provider.profile, {
        headers:{ Accept:'application/json', Authorization:'Bearer ' + data.access_token, 'User-Agent':'Brclio-Klarbase' },
        redirect:'error',
      });
      if(!user.ok) return fail();
      profile = await user.json();
    } catch { return fail(); }
    if(!profile || typeof profile !== 'object') return fail();
    const subject = provider.id(profile);
    if(typeof subject !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(subject)) return fail();

    const id = await hexDigest(name + ':' + subject);
    const displayName = String(provider.name(profile) || 'Klarbase player').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 80) || 'Klarbase player';
    const image = avatarUrl(provider.image(profile), provider.avatarHost);
    const token = random();
    const path = sessionPath(id, await hexDigest(token));
    const expiresAt = new Date(Date.now() + SESSION_AGE * 1000).toISOString();
    try {
      await store.mutate(async tx => {
        const previous = await tx.get(profilePath(id));
        if(!previous || previous.name !== displayName || previous.image !== image) tx.set(profilePath(id), { id, name:displayName, image });
        tx.set(path, { userId:id, expiresAt });
      });
    } catch(error){
      console.warn('Klarbase sign-in storage unavailable', { status:error?.status });
      return fail();
    }
    return redirect(safeReturn(flow.returnTo, origin), [expire, cookie('session', id + '.' + token, SESSION_AGE)]);
  }

  async function handle(request) {
    const url = new URL(request.url);
    const endpoint = url.pathname.slice(API.length);
    if(request.method === 'GET' && endpoint === '/providers') return response({ providers:url.origin === origin ? providers : [] });
    if(url.origin !== origin) return failure('Sign-in is available on the production hostname', 403);
    if(request.method === 'POST' && request.headers.get('origin') !== origin) return failure('Origin not allowed', 403);
    if(request.method === 'POST' && endpoint === '/sign-in/social') return start(request);
    if(request.method === 'GET' && endpoint.startsWith('/callback/')) return finish(request, url, endpoint.slice('/callback/'.length));
    if(request.method === 'GET' && endpoint === '/get-session') return response(await readSession(request));
    if(request.method === 'POST' && endpoint === '/sign-out') {
      const file = await sessionFile(request);
      if(file) await store.mutate(async tx => { if(await tx.get(file.path)) tx.delete(file.path); });
      return response({ success:true }, 200, cookie('session', '', 0));
    }
    return failure('Unknown auth endpoint', 404);
  }

  const getUser = async request => (await readSession(request))?.user || null;
  return { handle, getUser, configured };
}
