export const GITHUB_DEPLOYMENT = import.meta.env?.VITE_GITHUB_DEPLOYMENT === 'true';
export const STATIC_DEPLOYMENT = !GITHUB_DEPLOYMENT && import.meta.env?.VITE_STATIC_DEPLOYMENT === 'true';
export const BRCLIO_DEPLOYMENT = GITHUB_DEPLOYMENT || STATIC_DEPLOYMENT;
export const REPO_URL = BRCLIO_DEPLOYMENT
  ? 'https://github.com/Brclio/Brclio-klarbase'
  : 'https://github.com/TanmoyP/klarbase';
