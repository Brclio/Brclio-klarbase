// On Pages, API requests should not fall through to the game's HTML shell.
export function onRequest(){
  return Response.json({ error: 'The Brclio static edition has no game API.' }, { status: 404 });
}
