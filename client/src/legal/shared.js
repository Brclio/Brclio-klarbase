// Shared bits of the legal pages. Everything that is not static text (the operator's
// details come from build-time env vars) is escaped before it becomes HTML.
import { t, getLanguage } from '../i18n.js';
import { legalLink } from '../sitefoot.js';

export { REPO_URL as REPO } from '../deployment.js';
export const UPDATED = '2026-11-18';
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

const env = import.meta.env;
const clean = v => typeof v === 'string' ? v.trim() : '';
// The operator's details. NEVER hardcoded: they are injected at build time (see .env.example).
export const operator = () => ({
  name: clean(env.VITE_IMPRINT_NAME),
  address: clean(env.VITE_IMPRINT_ADDRESS).replace(/\\n/g, '\n'),   // real newlines or a literal \n both work
  email: clean(env.VITE_IMPRINT_EMAIL),
});
export const operatorConfigured = () => { const o = operator(); return !!(o.name && o.address && o.email); };

const lines = s => esc(s).replace(/\n/g, '<br>');
// Name, address and email as an HTML block, or a clear placeholder in an unconfigured (dev) build.
export function operatorBlock(){
  const o = operator();
  if(!operatorConfigured()) return t(
    "<p><b>Imprint not configured for this build.</b> The operator's name, address and email are set with the build variables <code>VITE_IMPRINT_NAME</code>, <code>VITE_IMPRINT_ADDRESS</code> and <code>VITE_IMPRINT_EMAIL</code>.</p>",
    '<p><b>此版本尚未配置运营者信息。</b>运营者的名称、地址和电子邮箱分别通过构建变量 <code>VITE_IMPRINT_NAME</code>、<code>VITE_IMPRINT_ADDRESS</code> 和 <code>VITE_IMPRINT_EMAIL</code> 设置。</p>');
  return `<p>${lines(o.name)}<br>${lines(o.address)}<br>${t('Email: ', '电子邮箱：')}<a href="mailto:${esc(o.email)}">${esc(o.email)}</a></p>`;
}
export const contactLine = () => {
  const o = operator();
  return operatorConfigured() ? `<a href="mailto:${esc(o.email)}">${esc(o.email)}</a>`
    : t(`the email address in the ${legalLink('imprint')}`, `${legalLink('imprint')}中列出的邮箱`);
};

export const updatedLine = d => {
  const date = new Date(d + 'T00:00:00Z').toLocaleDateString(getLanguage() === 'en' ? 'en-GB' : 'zh-CN', { day:'numeric', month:'long', year:'numeric', timeZone:'UTC' });
  return `<p><i>${t('Last updated ' + date + '.', '最近更新于' + date + '。')}</i></p>`;
};
export const authoritative = () => `<p><i>${t('If a translation of this page ever differs from the English version, the English version is the authoritative one.', '本页译文若与英文版有出入，以英文版为准。')}</i></p>`;
export const otherPages = () => `<p class="legal-links">${['privacy','terms','guidelines','imprint','licenses'].map(legalLink).join(' · ')}</p>`;
