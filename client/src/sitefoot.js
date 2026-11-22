// Internal links use data-go so the main router handles them without a reload.
import { BRCLIO_DEPLOYMENT, REPO_URL } from './deployment.js';
import { onLanguageChange, t } from './i18n.js';

const pages = {
  guidelines:['Guidelines', '社区守则'], privacy:['Privacy', '隐私政策'], terms:['Terms', '使用条款'],
  imprint:['Imprint', '运营者信息'], licenses:['Licences', '许可证与致谢'],
};
export function legalLink(name){
  return `<a href="/${name}" data-go="/${name}">${t(...pages[name])}</a>`;
}

export function siteFoot(){
  const ext = (u, label) => `<a href="${u}" target="_blank" rel="noopener">${label}</a>`;
  return `<nav class="site-foot" aria-label="${t('About Klarbase', '关于 Klarbase')}">${[
    ext(REPO_URL, t('Open source on GitHub', 'GitHub 开源仓库')),
    BRCLIO_DEPLOYMENT ? ext(REPO_URL + '/issues', t('Feedback on GitHub', '在 GitHub 反馈')) : ext(REPO_URL + '/discussions', t('Discussions', '讨论区')),
    ...Object.keys(pages).map(legalLink),
  ].join('<span aria-hidden="true"> · </span>')}</nav>`;
}

onLanguageChange(() => {
  document.querySelectorAll('nav.site-foot').forEach(nav => { nav.outerHTML = siteFoot(); });
});
