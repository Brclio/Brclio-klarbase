// The Cloudflare static build uses bundled isles and browser-local progress.
export const STATIC_DEPLOYMENT = import.meta.env?.VITE_STATIC_DEPLOYMENT === 'true';
export const REPO_URL = STATIC_DEPLOYMENT
  ? 'https://github.com/Brclio/Brclio-klarbase'
  : 'https://github.com/TanmoyP/klarbase';
