import { MAX_BYTES, mergeProgress, sanitizeProgress } from '@klar/core';
import { HttpError, json, readJson } from './http.js';

const sections = ['progress', 'dailies', 'map'];

async function readProgress(store, paths) {
  const records = await Promise.all(paths.map(path => store.get(path)));
  const data = records.some(Boolean) ? { v: 1 } : null;
  let updatedAt = null;
  for(const [i, record] of records.entries()) {
    if(!record) continue;
    data[sections[i]] = record.value;
    if(!updatedAt || record.updatedAt > updatedAt) updatedAt = record.updatedAt;
  }
  return { data: data && sanitizeProgress(data), updatedAt, records };
}

export async function routeProgress(request, { store, user }) {
  if(!user) throw new HttpError(401, 'login required');
  if(request.headers.get('X-Klarbase-Account') !== user.id) throw new HttpError(409, 'account changed');
  const prefix = `users/${user.id.slice(0, 2)}/${user.id}/save`;
  const paths = sections.map(section => `${prefix}/${section}.json`);
  if(request.method === 'GET') {
    const { data, updatedAt } = await store.read(tx => readProgress(tx, paths));
    return json({ data, updatedAt });
  }
  if(request.method !== 'PUT') return json({ error: 'method not allowed' }, 405, { Allow: 'GET, PUT' });

  const { data } = await readJson(request, MAX_BYTES + 32);
  if(data && JSON.stringify(data).length > MAX_BYTES) throw new HttpError(413, 'save too large');
  const incoming = sanitizeProgress(data);
  if(!incoming) throw new HttpError(400, 'not a valid save');

  const saved = await store.mutate(async tx => {
    const { data: previous, updatedAt, records } = await readProgress(tx, paths);
    const merged = sanitizeProgress(mergeProgress(previous, incoming));
    if(!merged) throw new HttpError(413, 'save too large');

    const now = new Date().toISOString();
    let changed = false;
    for(const [i, section] of sections.entries()) {
      const value = merged[section];
      if(!value || (!records[i] && !Object.keys(value).length)) continue;
      if(JSON.stringify(records[i]?.value) === JSON.stringify(value)) continue;
      tx.set(paths[i], { value, updatedAt: now });
      changed = true;
    }
    return { data: merged, updatedAt: changed ? now : updatedAt };
  });
  return json(saved);
}
