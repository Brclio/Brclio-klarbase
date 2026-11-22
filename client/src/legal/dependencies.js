import { t } from '../i18n.js';
import { esc } from './shared.js';

const BROWSER = [
  ['three', '0.170', 'MIT', 'https://github.com/mrdoob/three.js'],
  ['better-auth', '1.4.22', 'MIT', 'https://github.com/better-auth/better-auth'],
  ['posthog-js', '1.447', 'Apache-2.0 AND MIT', 'https://github.com/PostHog/posthog-js'],
];
const SERVER = [
  ['express', '4.x', 'MIT', 'https://github.com/expressjs/express'],
  ['better-auth', '1.4.22', 'MIT', 'https://github.com/better-auth/better-auth'],
  ['@prisma/client', '6.x', 'Apache-2.0', 'https://github.com/prisma/prisma'],
  ['express-rate-limit', '7.x', 'MIT', 'https://github.com/express-rate-limit/express-rate-limit'],
];
function label(packageName, browser) {
  if(browser && packageName === 'better-auth') return t('better-auth (upstream sign-in client)', 'better-auth（上游登录客户端）');
  if(packageName === 'posthog-js') return t('posthog-js (only loaded when analytics is on)', 'posthog-js（仅在开启分析时加载）');
  if(packageName === '@prisma/client') return t('@prisma/client and prisma', '@prisma/client 和 prisma');
  return packageName;
}
export const listDependencies = (browser) => `<ul>${(browser ? BROWSER : SERVER).map(([n, v, l, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(label(n, browser))}</a> ${esc(v)} — ${esc(l)}</li>`).join('')}</ul>`;
