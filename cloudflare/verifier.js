import { HttpError, json, readJson } from '../functions/_lib/http.js';
import { verifyIsle } from '../functions/_lib/verify-isle.js';
import { clearExpiredAttempts, handlePasswordService } from './passwords.js';

// The binding is private. Solver, password work and expiring attempt counters
// use distinct named object instances within the existing deployment.
export class KlarbaseVerifier {
  constructor(ctx){ this.storage = ctx?.storage; }

  async alarm(){ await clearExpiredAttempts(this.storage); }

  async fetch(request){
    const url = new URL(request.url);
    try {
      if(url.hostname === 'auth.internal') return await handlePasswordService(request, url.pathname, this.storage);
      if(url.pathname !== '/verify') return json({ error:'not found' }, 404);
      if(request.method !== 'POST') return json({ error:'method not allowed' }, 405, { Allow:'POST' });
      return json(verifyIsle(await readJson(request, 16384)));
    } catch(error){
      if(error instanceof HttpError) return json({ error:error.message }, error.status);
      return json({ error:'verification unavailable' }, 503);
    }
  }
}

export default { fetch:() => json({ error:'not found' }, 404) };
