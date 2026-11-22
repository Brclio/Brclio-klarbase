import { CURATED_ISLES, CONTRIB, DAILY, sha256hex } from '@klar/core';
import { parseComment } from '../../server/src/routes/comment-rules.js';
import { parseWildKey, wildExists } from '../../server/src/routes/wild-key.js';
import { HttpError, json, readJson } from './http.js';
import { ISLE_SHAPE_ERROR } from './verify-isle.js';

const REPORT_AUTOHIDE = 3;
const HOUR = 3600000;
// Leave room in the Free plan's 50 external subrequests for authentication,
// the Git reference and tree lookup, then fetch only the records on this page.
const PAGE_MAX = 35;
const PUZZLE_HASH = /^[0-9a-f]{64}$/;
const COMMUNITY_KEY = new RegExp(`^c/(${CONTRIB.AUTHOR.source.slice(1, -1)})/(${CONTRIB.ID.source.slice(1, -1)})$`);
const DAILY_KEY = new RegExp(`^d/(${DAILY.DATE.source.slice(1, -1)})$`);
const OFFICIAL = new Set(CURATED_ISLES.map(isle => isle.id));
const KEY_SEGMENT = /^[A-Za-z0-9_-]+$/;
const COMMENT_FILENAME = /^\d{13}-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

export function validIsleKey(key){
  return typeof key === 'string' && key.length <= 80 && (OFFICIAL.has(key) || COMMUNITY_KEY.test(key)
    || DAILY_KEY.test(key) || (key.startsWith('i/') && PUZZLE_HASH.test(key.slice(2))) || parseWildKey(key) !== null);
}

export async function isleExists(key, store, bundledKeys){
  if(!validIsleKey(key)) return false;
  if(OFFICIAL.has(key)) return true;
  if(key.startsWith('i/')) return (await store.get(puzzlePath(key.slice(2))))?.status === 'live';
  if(key.startsWith('w/')) return wildExists(key);
  return bundledKeys.has(key);
}

const puzzlePath = hash => `puzzles/${hash}.json`;
const keySegment = key => btoa(key).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const commentPrefix = key => `comments/${keySegment(key)}/`;
const sortTime = now => String(now).padStart(13, '0');
const puzzleFeed = 'puzzle-feed/';
const authorFeed = user => `puzzle-authors/${sha256hex(user.id)}/`;
const puzzleEntry = p => `${sortTime(Date.parse(p.createdAt))}-${p.hash}.json`;
const missing = () => json({ error:'not found' }, 404);
const userRequired = () => json({ error:'login required' }, 401);
const validation = (code, text) => json({ errors:[{ code, text }] }, 422);
const publicAuthor = user => ({ id:user.id, name:user.name });
const publicPuzzle = p => ({ hash:p.hash, title:p.title, status:p.status, createdAt:p.createdAt, author:publicAuthor(p.author) });
const browsePuzzle = p => ({ ...publicPuzzle(p), isle:true, theme:p.puzzle.theme, par:p.puzzle.par,
  tier:p.puzzle.tier || null, audit:p.puzzle.audit || null });
const publicComment = (c, user) => ({ id:c.id, body:c.body, createdAt:c.createdAt,
  author:{ name:c.author.name, image:c.author.image || null }, mine:user?.id === c.author.id });

function commentPath(id){
  if(typeof id !== 'string' || id.length > 158) return null;
  const [segment, filename, ...extra] = id.split('.');
  if(extra.length || !KEY_SEGMENT.test(segment) || !COMMENT_FILENAME.test(filename)) return null;
  let key;
  try { key = atob(segment.replaceAll('-', '+').replaceAll('_', '/')); } catch { return null; }
  if(!validIsleKey(key) || segment !== keySegment(key)) return null;
  return `comments/${segment}/${filename}.json`;
}

function limitOf(params, fallback){
  return Math.min(Math.max(parseInt(params.get('limit'), 10) || fallback, 1), PAGE_MAX);
}

async function readPage(tx, prefix, limit, after){
  const paths = await tx.listPaths(prefix);
  const available = after ? paths.filter(path => path < after) : paths;
  const selected = available.slice(-limit).reverse(), page = [];
  for(let i = 0; i < selected.length; i += 5){
    const batch = await Promise.all(selected.slice(i, i + 5).map(path => tx.get(path)));
    page.push(...batch);
  }
  return { page, hasNext:available.length > limit, count:paths.length };
}

function checkRate(row, now, limit, message){
  const count = row && now - row.from < HOUR ? row.count : 0;
  if(count >= limit) throw new HttpError(429, message);
  return { from:count ? row.from : now, count:count + 1 };
}

async function recordAction(tx, type, user, now, limit, message){
  const path = `limits/${type}/${sha256hex(user.id)}.json`;
  tx.set(path, checkRate(await tx.get(path), now, limit, message));
}

function deduped(p, user){
  return json({ hash:p.hash, deduped:true, author:publicAuthor(p.author) }, p.author.id === user.id ? 200 : 409);
}

async function listPuzzles(store, user, params){
  const mine = params.get('author') === 'me';
  if(mine && !user) return userRequired();
  const prefix = mine ? authorFeed(user) : puzzleFeed;
  return store.read(async tx => {
    const cursor = params.get('cursor');
    let after;
    if(cursor){
      if(!PUZZLE_HASH.test(cursor)) return json({ puzzles:[], nextCursor:null });
      const p = await tx.get(puzzlePath(cursor));
      if(!p || (mine && p.author.id !== user.id)) return json({ puzzles:[], nextCursor:null });
      after = prefix + puzzleEntry(p);
    }
    const { page, hasNext } = await readPage(tx, prefix, limitOf(params, 24), after);
    return json({ puzzles:page.map(p => ({ ...p, mine:user?.id === p.author.id })), nextCursor:hasNext ? page.at(-1).hash : null });
  });
}

function putPuzzle(tx, row){
  const entry = puzzleEntry(row), browse = browsePuzzle(row);
  tx.set(puzzlePath(row.hash), row);
  tx.set(authorFeed(row.author) + entry, browse);
  if(row.status === 'live') tx.set(puzzleFeed + entry, browse);
  else tx.delete(puzzleFeed + entry);
}

async function publish(request, store, user, verifyPuzzle){
  const { title, puzzle } = await readJson(request, 16384);
  if(typeof title !== 'string' || !title.trim() || title.trim().length > 60) return json({ error:'title required (max 60 chars)' }, 400);
  if(!puzzle || typeof puzzle !== 'object' || Array.isArray(puzzle)) return validation('E_SHAPE', ISLE_SHAPE_ERROR);
  if(!verifyPuzzle) throw new HttpError(503, 'puzzle verification unavailable');
  const now = Date.now(), limitMessage = 'publish limit reached — 20 per hour';
  checkRate(await store.get(`limits/publish/${sha256hex(user.id)}.json`), now, 20, limitMessage);
  const result = await verifyPuzzle(puzzle);
  if(result.errors) return json({ errors:result.errors }, 422);
  const { hash, puzzle:verified } = result, path = puzzlePath(hash);
  const row = { hash, title:title.trim(), status:'live', createdAt:new Date(now).toISOString(), author:publicAuthor(user), puzzle:verified };

  return store.mutate(async tx => {
    const concurrent = await tx.get(path);
    if(concurrent) return deduped(concurrent, user);
    await recordAction(tx, 'publish', user, now, 20, limitMessage);
    putPuzzle(tx, row);
    return json({ ...publicPuzzle(row), par:verified.par }, 201);
  });
}

async function removeOwned(store, path, prefix, user, comment = false){
  return store.mutate(async tx => {
    const row = await tx.get(path) || (comment ? await tx.get(`hidden-${path}`) : null);
    if(!row || row.author.id !== user.id) return missing();
    for(const report of await tx.listPaths(prefix)) tx.delete(report);
    if(comment) tx.delete(row.hidden ? `hidden-${path}` : path);
    else {
      const entry = puzzleEntry(row);
      tx.delete(path);
      tx.delete(authorFeed(row.author) + entry);
      if(row.status === 'live') tx.delete(puzzleFeed + entry);
    }
    return json({ ok:true });
  });
}

async function report(store, path, prefix, user, reason, comment){
  const now = Date.now();
  return store.mutate(async tx => {
    const row = await tx.get(path);
    if(!row) return comment && (await tx.get(`hidden-${path}`)) ? json({ ok:true }) : missing();
    if(comment && row.author.id === user.id) return json({ error:'that one is yours — delete it instead' }, 400);
    if(!comment && row.status === 'hidden') return json({ ok:true });
    const existing = await tx.listPaths(prefix);
    const reportPath = `${prefix}${sha256hex(user.id)}.json`;
    if(existing.includes(reportPath)) return json({ ok:true });
    await recordAction(tx, 'report', user, now, 30, 'report limit reached');
    tx.set(reportPath, { reporterId:user.id, ...(reason ? { reason } : {}), createdAt:new Date(now).toISOString() });
    if(existing.length + 1 >= REPORT_AUTOHIDE){
      if(comment){
        tx.set(`hidden-${path}`, { ...row, hidden:true });
        tx.delete(path);
      } else putPuzzle(tx, { ...row, status:'hidden' });
    }
    return json({ ok:true });
  });
}

async function puzzlesRoute(request, store, user, parts, params, verifyPuzzle){
  const [hash, action] = parts;
  if(parts.length === 0){
    if(request.method === 'GET') return listPuzzles(store, user, params);
    if(request.method === 'POST') return user ? publish(request, store, user, verifyPuzzle) : userRequired();
  }
  if(!PUZZLE_HASH.test(hash || '') || parts.length > 2) return missing();
  const path = puzzlePath(hash), prefix = `puzzle-reports/${hash}/`;
  if(!action && request.method === 'GET'){
    const row = await store.get(path);
    if(!row || row.status === 'hidden') return missing();
    const puzzle = { ...row.puzzle };
    if(!user) delete puzzle.solution;
    return json({ ...publicPuzzle(row), puzzle });
  }
  if(!action && request.method === 'DELETE') return user ? removeOwned(store, path, prefix, user) : userRequired();
  if(action === 'report' && request.method === 'POST'){
    if(!user) return userRequired();
    const body = request.body ? await readJson(request, 2048) : {};
    const reason = typeof body.reason === 'string' ? body.reason.slice(0, 500) : '';
    return report(store, path, prefix, user, reason, false);
  }
  return missing();
}

async function listComments(store, user, params){
  const key = params.get('key');
  if(!validIsleKey(key)) return json({ error:'unknown isle key' }, 400);
  return store.read(async tx => {
    if(key.startsWith('i/') && !(await isleExists(key, tx))) return json({ comments:[], next:null, count:0 });
    const prefix = commentPrefix(key), cursor = params.get('cursor');
    const after = cursor ? commentPath(cursor) : undefined;
    if(cursor && !after?.startsWith(prefix)) return json({ error:'invalid comment cursor' }, 400);
    const { page, hasNext, count } = await readPage(tx, prefix, limitOf(params, 20), after);
    return json({ comments:page.map(c => publicComment(c, user)), next:hasNext ? page.at(-1).id : null, count });
  });
}

async function postComment(request, store, user, bundledKeys){
  const { key, body } = await readJson(request, 4096);
  if(!validIsleKey(key)) return json({ error:'unknown isle key' }, 400);
  const parsed = parseComment(body);
  if(!parsed.ok) return json({ error:parsed.error }, 400);
  const now = Date.now(), file = `${sortTime(now)}-${crypto.randomUUID()}`, id = `${keySegment(key)}.${file}`;
  const row = { id, body:parsed.body, hidden:false, createdAt:new Date(now).toISOString(),
    author:{ ...publicAuthor(user), image:user.image || null } };
  return store.mutate(async tx => {
    if(!(await isleExists(key, tx, bundledKeys))) return json({ error:'unknown isle' }, 404);
    await recordAction(tx, 'comment', user, now, 20, 'comment limit reached — 20 per hour');
    tx.set(`${commentPrefix(key)}${file}.json`, row);
    return json({ comment:publicComment(row, user) }, 201);
  });
}

async function commentsRoute(request, store, user, parts, params, bundledKeys){
  const [id, action] = parts;
  if(parts.length === 0){
    if(request.method === 'GET') return listComments(store, user, params);
    if(request.method === 'POST') return user ? postComment(request, store, user, bundledKeys) : userRequired();
  }
  const path = commentPath(id);
  if(!path || parts.length > 2) return missing();
  const prefix = `comment-reports/${id}/`;
  if(!action && request.method === 'DELETE') return user ? removeOwned(store, path, prefix, user, true) : userRequired();
  if(action === 'report' && request.method === 'POST') return user ? report(store, path, prefix, user, '', true) : userRequired();
  return missing();
}

export async function routeIsles(request, { store, user = null, bundledKeys = new Set(), verifyPuzzle }){
  const { pathname, searchParams } = new URL(request.url);
  const [, api, route, ...parts] = pathname.replace(/\/+$/, '').split('/');
  if(api !== 'api') return null;
  if(route === 'puzzles') return puzzlesRoute(request, store, user, parts, searchParams, verifyPuzzle);
  if(route === 'comments') return commentsRoute(request, store, user, parts, searchParams, bundledKeys);
  return null;
}
