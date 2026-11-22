import { HttpError, json, readJson } from '../functions/_lib/http.js';
import { verifyIsle } from '../functions/_lib/verify-isle.js';

// Invoked through a Durable Object binding from the authenticated publish route.
// The solver uses its own CPU allowance and reads or writes no stored data here.
export class KlarbaseVerifier {
  async fetch(request){
    if(new URL(request.url).pathname !== '/verify') return json({ error:'not found' }, 404);
    if(request.method !== 'POST') return json({ error:'method not allowed' }, 405, { Allow:'POST' });
    try {
      return json(verifyIsle(await readJson(request, 16384)));
    } catch(error){
      if(error instanceof HttpError) return json({ error:error.message }, error.status);
      return json({ error:'puzzle verification unavailable' }, 503);
    }
  }
}

export default { fetch:() => json({ error:'not found' }, 404) };
