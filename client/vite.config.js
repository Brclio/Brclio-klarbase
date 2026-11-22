import { defineConfig } from 'vite';
import { SITE_URL } from './src/deployment.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// sitemap.xml — built from the same isle files the client bundles (official
// chapters, community isles, hand-made dailies), so every playable page is listed
// without hand edits. Past dailies only: live never opens today's or a future date
// by its own URL. No <lastmod> — a build date on every URL would be a guess.
const ISLES = fileURLToPath(new URL('../isles/', import.meta.url));
const json = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const dirs = d => fs.readdirSync(d, { withFileTypes:true }).filter(e => e.isDirectory()).map(e => e.name);
function bundledIsleKeys(){
  const keys = [];
  for(const author of dirs(path.join(ISLES, 'community'))){
    for(const file of fs.readdirSync(path.join(ISLES, 'community', author)).filter(f => f.endsWith('.json'))){
      const doc = json(path.join(ISLES, 'community', author, file));
      if(doc.author && doc.id) keys.push(`c/${doc.author}/${doc.id}`);
    }
  }
  for(const file of fs.readdirSync(path.join(ISLES, 'daily'))){
    const date = /^(\d{4}-\d{2}-\d{2})\.json$/.exec(file);
    if(date) keys.push(`d/${date[1]}`);
  }
  return keys;
}
function sitemapXml(){
  const today = new Date().toISOString().slice(0, 10);
  const paths = ['/', '/play', '/daily', '/community', '/map', '/create', '/how-to-build', '/privacy', '/terms', '/guidelines', '/imprint', '/licenses'];
  for(const ch of json(path.join(ISLES, 'official/chapters.json'))) for(const id of ch.isles) paths.push(`/isle/${id}`);
  for(const key of bundledIsleKeys()){
    if(key.startsWith('c/')) paths.push(`/${key}`);
    else if(key.slice(2) < today) paths.push(`/daily/${key.slice(2)}`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map(p => `  <url><loc>${SITE_URL}${p}</loc></url>`).join('\n')}\n</urlset>\n`;
}
const sitemap = () => ({
  name:'klarbase-sitemap',
  configureServer(server){ server.middlewares.use('/sitemap.xml', (_req, res) => { res.setHeader('content-type', 'application/xml'); res.end(sitemapXml()); }); },
  generateBundle(){
    this.emitFile({ type:'asset', fileName:'sitemap.xml', source:sitemapXml() });
    if(process.env.VITE_GITHUB_DEPLOYMENT === 'true'){
      this.emitFile({ type:'asset', fileName:'isle-index.json', source:JSON.stringify(bundledIsleKeys()) });
    }
  },
});

export default defineConfig({
  plugins: [sitemap()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000', '/ingest': 'http://localhost:3000' },   // dev: same-origin, no CORS; /ingest = PostHog proxy
  },
  build: { outDir: 'dist', sourcemap: true, target: 'es2022' },  // top-level await
});
