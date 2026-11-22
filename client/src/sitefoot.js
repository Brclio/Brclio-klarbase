// Klarbase — the one site footer. Shared by the title screen, the help modal and the legal/guideline pages.
// Internal links carry data-go: main.js's global click handler routes them in-app (no reload).
import { REPO_URL, STATIC_DEPLOYMENT } from './deployment.js';
export function siteFoot(){
  const go = (p, t) => `<a href="${p}" data-go="${p}">${t}</a>`;
  const ext = (u, t) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`;
  return `<nav class="site-foot" aria-label="About Klarbase">${[
    ext(REPO_URL, 'Open source on GitHub'),
    STATIC_DEPLOYMENT ? ext(REPO_URL + '/issues', 'Feedback on GitHub') : ext(REPO_URL + '/discussions', 'Discussions'),
    go('/guidelines', 'Guidelines'), go('/privacy', 'Privacy'), go('/terms', 'Terms'),
    go('/imprint', 'Imprint'), go('/licenses', 'Licences'),
  ].join('<span aria-hidden="true"> · </span>')}</nav>`;
}
