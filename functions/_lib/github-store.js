const API_URL = 'https://api.github.com';
const BRANCH = 'main';
const DATA_DIR = 'data';
const MAX_RECORD_BYTES = 700_000;
const MAX_ATTEMPTS = 4;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const rsa = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
let cachedInstallation;

class StoreError extends Error {
  constructor(message, status = 503) {
    super(message);
    this.status = status;
  }
}

function bytesFromBase64(value) {
  return Uint8Array.from(atob(value), character => character.charCodeAt(0));
}

function base64FromBytes(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

function base64Url(bytes) {
  return base64FromBytes(bytes).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function concat(...parts) {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function der(tag, body) {
  const length = [];
  for (let size = body.length; size > 0; size >>>= 8) length.unshift(size & 255);
  const header = body.length < 128 ? [tag, body.length] : [tag, 128 | length.length, ...length];
  return concat(Uint8Array.from(header), body);
}

async function signInstallationRequest(appId, pem) {
  const match = /^-----BEGIN (RSA )?PRIVATE KEY-----\s*([\s\S]+?)\s*-----END \1PRIVATE KEY-----$/.exec(
    pem.replaceAll('\\n', '\n').trim(),
  );
  if (!match) throw new StoreError('Invalid GitHub App private key');

  let keyBytes = bytesFromBase64(match[2].replace(/\s/g, ''));
  if (match[1]) {
    // GitHub can issue PKCS#1 RSA keys. Web Crypto imports PKCS#8 PrivateKeyInfo.
    const versionAndRsaIdentifier = Uint8Array.of(
      0x02, 0x01, 0x00, 0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86,
      0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00,
    );
    keyBytes = der(0x30, concat(versionAndRsaIdentifier, der(0x04, keyBytes)));
  }
  const key = await crypto.subtle.importKey('pkcs8', keyBytes, rsa, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(encoder.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = base64Url(encoder.encode(JSON.stringify({ iss: appId, iat: now - 60, exp: now + 540 })));
  const payload = `${header}.${claims}`;
  const signature = await crypto.subtle.sign(rsa, key, encoder.encode(payload));
  return `${payload}.${base64Url(new Uint8Array(signature))}`;
}

function normalizePath(path, directory = false) {
  if (typeof path !== 'string') throw new TypeError('Invalid GitHub data path');
  const normalized = directory ? path.replace(/\/$/, '') : path;
  if (directory && normalized === '') return normalized;
  const segments = normalized.split('/');
  if (!segments.every(segment => /^[A-Za-z\d_-][A-Za-z\d_.-]{0,199}$/.test(segment))) {
    throw new TypeError('Invalid GitHub data path');
  }
  if (!directory && !normalized.endsWith('.json')) throw new TypeError('GitHub data paths must end in .json');
  return normalized;
}

function config(env) {
  const appId = String(env.GITHUB_APP_ID || '');
  const installationId = String(env.GITHUB_APP_INSTALLATION_ID || '');
  const pem = env.GITHUB_APP_PRIVATE_KEY;
  const encryptionKey = env.GITHUB_DATA_ENCRYPTION_KEY;
  const repository = env.GITHUB_DATA_REPOSITORY || '';
  const match = /^([A-Za-z\d][A-Za-z\d-]{0,38})\/([A-Za-z\d_.-]{1,100})$/.exec(repository);
  if (!match || /^\.{1,2}$/.test(match[2]) || !/^\d+$/.test(installationId)
    || !/^(?:\d+|Iv\d+\.[A-Za-z\d]+|Ov\d+\.[A-Za-z\d]+)$/.test(appId)
    || typeof pem !== 'string' || typeof encryptionKey !== 'string') {
    throw new StoreError('GitHub data storage is not configured');
  }
  return { appId, installationId, pem, repository, repoName: match[2], encryptionKey };
}

async function jsonResponse(response) {
  try {
    return await response.json();
  } catch {
    throw new StoreError('GitHub returned an invalid storage response');
  }
}

export function createGitHubStore(env, fetcher = fetch) {
  const { appId, installationId, pem, repository, repoName, encryptionKey } = config(env);
  const identity = `${appId}/${installationId}/${repository.toLowerCase()}`;
  const repoPath = `/repos/${repository}`;
  let encryption;

  async function getEncryption() {
    if (!encryption) {
      try {
        const bytes = bytesFromBase64(encryptionKey.trim());
        if (bytes.length !== 32) throw new Error('Invalid key length');
        encryption = await crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
      } catch {
        throw new StoreError('Invalid GitHub data encryption key');
      }
    }
    return encryption;
  }

  async function encrypt(path, content) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await getEncryption();
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(path) }, key, content);
    return JSON.stringify({ version: 1, data: base64FromBytes(concat(iv, new Uint8Array(encrypted))) });
  }

  async function decrypt(path, content) {
    const key = await getEncryption();
    try {
      const entry = JSON.parse(content);
      if (entry.version !== 1 || typeof entry.data !== 'string') throw new Error('Unknown data format');
      const bytes = bytesFromBase64(entry.data);
      const plaintext = await crypto.subtle.decrypt({
        name: 'AES-GCM', iv: bytes.subarray(0, 12), additionalData: encoder.encode(path),
      }, key, bytes.subarray(12));
      return decoder.decode(plaintext);
    } catch {
      throw new StoreError('Could not decrypt a GitHub data record');
    }
  }

  async function request(path, token, { method = 'GET', body } = {}) {
    try {
      return await fetcher(`${API_URL}${path}`, {
        method,
        redirect: 'error',
        headers: {
          accept: 'application/vnd.github+json',
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          'user-agent': 'Brclio-Klarbase',
          'x-github-api-version': '2022-11-28',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new StoreError('GitHub data storage is temporarily unavailable');
    }
  }

  async function installationToken() {
    if (cachedInstallation?.identity === identity && cachedInstallation.expiresAt > Date.now() + 60_000) {
      return cachedInstallation.token;
    }
    let jwt;
    try {
      jwt = await signInstallationRequest(appId, pem);
    } catch {
      throw new StoreError('Invalid GitHub App private key');
    }
    const response = await request(`/app/installations/${installationId}/access_tokens`, jwt, {
      method: 'POST', body: { repositories: [repoName], permissions: { contents: 'write' } },
    });
    if (!response.ok) throw new StoreError(`GitHub could not authorize data storage (${response.status})`);
    const { token, expires_at: expiresAt } = await jsonResponse(response);
    if (typeof token !== 'string' || !Number.isFinite(Date.parse(expiresAt))) {
      throw new StoreError('GitHub returned an invalid installation token');
    }
    cachedInstallation = { identity, token, expiresAt: Date.parse(expiresAt) };
    return token;
  }

  async function api(path, options) {
    let token = await installationToken();
    let response = await request(repoPath + path, token, options);
    if (response.status === 401) {
      if (cachedInstallation?.token === token) cachedInstallation = undefined;
      await response.body?.cancel();
      token = await installationToken();
      response = await request(repoPath + path, token, options);
    }
    return response;
  }

  async function getObject(path) {
    const response = await api(path);
    if (!response.ok) throw new StoreError(`GitHub data storage request failed (${response.status})`);
    return jsonResponse(response);
  }

  async function readRecord(path, revision) {
    const target = path.split('/').map(encodeURIComponent).join('/');
    const response = await api(`/contents/${DATA_DIR}/${target}?ref=${revision}`);
    // The installation token was issued for this private repository. A missing key is expected.
    if (response.status === 404) {
      await response.body?.cancel();
      return null;
    }
    if (!response.ok) throw new StoreError(`GitHub data storage read failed (${response.status})`);
    const record = await jsonResponse(response);
    if (record.type !== 'file' || record.encoding !== 'base64' || typeof record.content !== 'string') {
      throw new StoreError('GitHub returned an invalid data record');
    }
    return decrypt(path, decoder.decode(bytesFromBase64(record.content)));
  }

  async function head() {
    const ref = await getObject(`/git/ref/heads/${BRANCH}`);
    return ref.object.sha;
  }

  function snapshot(revision) {
    let treeSha;
    const originals = new Map();
    const changes = new Map();

    async function baseTree() {
      if (!treeSha) treeSha = (await getObject(`/git/commits/${revision}`)).tree.sha;
      return treeSha;
    }

    async function original(path) {
      if (!originals.has(path)) originals.set(path, await readRecord(path, revision));
      return originals.get(path);
    }

    async function get(path) {
      path = normalizePath(path);
      const content = changes.has(path) ? changes.get(path) : await original(path);
      return content === null ? null : JSON.parse(content);
    }

    async function listPaths(prefix = '') {
      prefix = normalizePath(prefix, true);
      const parentPath = prefix ? `${prefix}/` : '';
      let directorySha = await baseTree();
      const requestedDirectory = prefix ? `${DATA_DIR}/${prefix}` : DATA_DIR;
      for (const segment of requestedDirectory.split('/')) {
        const { tree } = await getObject(`/git/trees/${directorySha}`);
        directorySha = tree.find(entry => entry.path === segment && entry.type === 'tree')?.sha;
        if (!directorySha) break;
      }

      const paths = new Set();
      if (directorySha) {
        const { tree, truncated } = await getObject(`/git/trees/${directorySha}?recursive=1`);
        if (truncated) throw new StoreError('GitHub data directory is too large to list');
        for (const entry of tree) {
          if (entry.type === 'blob' && entry.mode === '100644' && entry.path.endsWith('.json')) {
            paths.add(parentPath + entry.path);
          }
        }
      }
      for (const [path, value] of changes) {
        if (!path.startsWith(parentPath)) continue;
        if (value === null) paths.delete(path);
        else paths.add(path);
      }
      return [...paths].sort();
    }

    async function list(prefix = '', { reverse = false, limit, after } = {}) {
      if (limit !== undefined && (!Number.isInteger(limit) || limit < 0)) throw new TypeError('Invalid list limit');
      if (after !== undefined) after = normalizePath(after);
      let paths = await listPaths(prefix);
      if (after) paths = paths.filter(path => reverse ? path < after : path > after);
      if (reverse) paths.reverse();
      if (limit !== undefined) paths = paths.slice(0, limit);
      const records = [];
      for (let index = 0; index < paths.length; index += 5) {
        const batch = paths.slice(index, index + 5);
        records.push(...await Promise.all(batch.map(async path => ({ path, value: await get(path) }))));
      }
      return records;
    }

    function set(path, value) {
      path = normalizePath(path);
      const content = JSON.stringify(value);
      if (content === undefined || content === 'null') throw new TypeError('Invalid GitHub data record');
      if (encoder.encode(content).length > MAX_RECORD_BYTES) throw new StoreError('Data record is too large', 413);
      changes.set(path, content);
    }

    function remove(path) {
      changes.set(normalizePath(path), null);
    }

    async function writeTree() {
      const tree = [];
      for (const [path, value] of changes) {
        if (value === null ? await original(path) === null : originals.get(path) === value) continue;
        const entry = { path: `${DATA_DIR}/${path}`, mode: '100644', type: 'blob' };
        if (value === null) entry.sha = null;
        else entry.content = await encrypt(path, encoder.encode(value));
        tree.push(entry);
      }
      if (!tree.length) return null;
      const response = await api('/git/trees', { method: 'POST', body: { base_tree: await baseTree(), tree } });
      if (!response.ok) throw new StoreError(`GitHub could not save data records (${response.status})`);
      return (await jsonResponse(response)).sha;
    }

    return { view: { get, listPaths, list, set, delete: remove }, writeTree };
  }

  async function read(callback) {
    const { get, listPaths, list } = snapshot(await head()).view;
    return callback({ get, listPaths, list });
  }

  // A callback can run again against a newer commit if another writer wins the race.
  // Keep network calls and side effects outside it apart from accesses through its transaction.
  async function mutate(callback) {
    let revision = await head();
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const { view, writeTree } = snapshot(revision);
      const result = await callback(view);
      const tree = await writeTree();
      if (!tree) return result;
      const response = await api('/git/commits', {
        method: 'POST', body: { message: 'Update Klarbase application data', tree, parents: [revision] },
      });
      if (!response.ok) throw new StoreError(`GitHub could not commit data records (${response.status})`);
      const { sha } = await jsonResponse(response);
      const updated = await api(`/git/refs/heads/${BRANCH}`, { method: 'PATCH', body: { sha, force: false } });
      await updated.body?.cancel();
      if (updated.ok) return result;
      if (updated.status !== 409 && updated.status !== 422) {
        throw new StoreError(`GitHub could not update the data branch (${updated.status})`);
      }
      const current = await head();
      if (current === sha) return result;
      if (current === revision) throw new StoreError('GitHub rejected the data branch update');
      revision = current;
    }
    throw new StoreError('Concurrent data updates, please retry');
  }

  return {
    async get(path) {
      const content = await readRecord(normalizePath(path), BRANCH);
      return content === null ? null : JSON.parse(content);
    },
    listPaths: prefix => read(view => view.listPaths(prefix)),
    list: (prefix, options) => read(view => view.list(prefix, options)),
    read,
    mutate,
  };
}
