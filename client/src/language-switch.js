import { getLanguage, setLanguage, onLanguageChange, t } from './i18n.js';
import './language-switch.css';

// Record the shell's original strings once. Only explicitly marked labels belong here.
// Dynamic views render their own strings and player-supplied text stays as authored.
const labels = [];
for (const attr of ['textContent', 'title', 'aria-label', 'placeholder', 'content']) {
  const marker = attr === 'textContent' ? 'data-zh' : 'data-zh-' + attr;
  const englishMarker = marker.replace('data-zh', 'data-en');
  for (const node of document.querySelectorAll('[' + englishMarker + ']')) {
    const chinese = attr === 'textContent' ? node.textContent : node.getAttribute(attr);
    labels.push({ node, attr, english:node.getAttribute(englishMarker), chinese });
  }
  for (const node of document.querySelectorAll('[' + marker + ']')) {
    const english = attr === 'textContent' ? node.textContent : node.getAttribute(attr);
    labels.push({ node, attr, english, chinese:node.getAttribute(marker) });
  }
}

const button = document.getElementById('btnLanguage');
function renderLanguage() {
  const language = getLanguage();
  document.documentElement.lang = language;
  for (const { node, attr, english, chinese } of labels) {
    const value = t(english, chinese);
    if (attr === 'textContent') node.textContent = value;
    else node.setAttribute(attr, value);
  }
  const manifest = document.querySelector('link[rel=manifest]');
  manifest.setAttribute('href', t('/site.en.webmanifest', '/site.webmanifest'));
  button.lang = language === 'en' ? 'zh-CN' : 'en';
  button.textContent = t('中文', 'EN');
  button.title = t('切换到中文', 'Switch to English');
  button.setAttribute('aria-label', button.title);
}
button.addEventListener('keydown', event => {
  // Let the focused button handle keyboard activation before the game's Space/Enter bindings.
  if (event.key === ' ' || event.key === 'Enter') event.stopPropagation();
});
button.addEventListener('click', event => {
  setLanguage(getLanguage() === 'en' ? 'zh-CN' : 'en');
  if (event.detail) button.blur();
});
renderLanguage();
onLanguageChange(renderLanguage);
