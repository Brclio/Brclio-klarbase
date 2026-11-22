export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function json(payload, status = 200, headers = {}) {
  return Response.json(payload, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

export async function readJson(request, maxBytes) {
  const type = request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
  if(type !== 'application/json') throw new HttpError(415, 'expected application/json');
  if(Number(request.headers.get('Content-Length')) > maxBytes) throw new HttpError(413, 'request too large');
  if(!request.body) throw new HttpError(400, 'expected a JSON object');

  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let size = 0, text = '';
  try {
    for(;;) {
      const { done, value } = await reader.read();
      if(done) break;
      size += value.byteLength;
      if(size > maxBytes) {
        await reader.cancel();
        throw new HttpError(413, 'request too large');
      }
      text += decoder.decode(value, { stream: true });
    }
    const value = JSON.parse(text + decoder.decode());
    if(value && typeof value === 'object' && !Array.isArray(value)) return value;
  } catch(error) {
    if(error instanceof HttpError) throw error;
  } finally {
    reader.releaseLock();
  }
  throw new HttpError(400, 'expected a JSON object');
}
