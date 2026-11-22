import { t, getLanguage } from '../i18n.js';
import { legalLink } from '../sitefoot.js';
import { CONTACT_EMAIL } from '../deployment.js';

export { REPO_URL as REPO } from '../deployment.js';
export const UPDATED = '2026-11-22';
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
export const contactLine = () => `<a href="mailto:${esc(CONTACT_EMAIL)}">${esc(CONTACT_EMAIL)}</a>`;
export const updatedLine = (d = UPDATED) => {
  const date = new Date(d + 'T00:00:00Z').toLocaleDateString(getLanguage() === 'en' ? 'en-GB' : 'zh-CN', { day:'numeric', month:'long', year:'numeric', timeZone:'UTC' });
  return `<p><i>${t('Last updated ' + date + '.', '最近更新于' + date + '。')}</i></p>`;
};
export const otherPages = () => `<p class="legal-links">${['privacy','terms','guidelines','imprint','licenses'].map(legalLink).join(' · ')}</p>`;
