import { t } from '../i18n.js';
import { esc } from './shared.js';

export const brandAttribution = {
  kit:encodeURI('https://github.com/Brclio/brand-studio/blob/5988c0e1c7ea4b861c9cdbd54631427cc172bfe4/data/Brclio 组织头像/brclio-brand-kit/ATTRIBUTION.md'),
  design:'https://github.com/esthersjw/esther-design-system',
  licence:'https://creativecommons.org/licenses/by-nc-sa/4.0/',
};

const BROWSER = [
  ['three', '0.170.0', 'MIT', 'https://github.com/mrdoob/three.js'],
  ['better-auth', '1.4.22', 'MIT', 'https://github.com/better-auth/better-auth'],
  ['posthog-js', '1.447.15', 'Apache-2.0 AND MIT', 'https://github.com/PostHog/posthog-js'],
];
const SERVER = [
  ['express', '4.22.2', 'MIT', 'https://github.com/expressjs/express'],
  ['better-auth', '1.4.22', 'MIT', 'https://github.com/better-auth/better-auth'],
  ['@prisma/client', '6.19.3', 'Apache-2.0', 'https://github.com/prisma/prisma'],
  ['express-rate-limit', '7.5.1', 'MIT', 'https://github.com/express-rate-limit/express-rate-limit'],
];
function label(packageName, browser) {
  if(browser && packageName === 'better-auth') return t('better-auth (optional sign-in client)', 'better-auth（可选登录客户端）');
  if(packageName === 'posthog-js') return t('posthog-js (only loaded when analytics is on)', 'posthog-js（仅在开启分析时加载）');
  if(packageName === '@prisma/client') return t('@prisma/client and prisma', '@prisma/client 和 prisma');
  return packageName;
}
export const listDependencies = (browser) => `<ul>${(browser ? BROWSER : SERVER).map(([n, v, l, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(label(n, browser))}</a> ${esc(v)} — ${esc(l)}</li>`).join('')}</ul>`;
