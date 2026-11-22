// Internal links use data-go so the main router handles them without a reload.
import { PERSONAL_URL, REPO_URL } from './deployment.js';
import { onLanguageChange, t } from './i18n.js';

const pages = {
  guidelines:['Guidelines', '社区守则'], privacy:['Privacy', '隐私政策'], terms:['Terms', '使用条款'],
  imprint:['Project & contact', '项目与联系'], licenses:['Licences', '许可证与致谢'],
};
export function legalLink(name){
  return `<a href="/${name}" data-go="/${name}">${t(...pages[name])}</a>`;
}

export function siteFoot(){
  const ext = (u, label) => `<a href="${u}" target="_blank" rel="noopener">${label}</a>`;
  return `<nav class="site-foot" aria-label="${t('About Brclio Klarbase', '关于 Brclio Klarbase')}">${[
    ext(PERSONAL_URL, t('Maintained by AI悦创', 'AI悦创维护')),
    ext(REPO_URL, t('Brclio on GitHub', 'Brclio 开源仓库')),
    ext(REPO_URL + '/issues', t('Project feedback', '项目反馈')),
    ...Object.keys(pages).map(legalLink),
  ].join('<span aria-hidden="true"> · </span>')}</nav>`;
}

onLanguageChange(() => {
  document.querySelectorAll('nav.site-foot').forEach(nav => { nav.outerHTML = siteFoot(); });
});
