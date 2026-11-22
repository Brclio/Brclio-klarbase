// Vite loads only the requested page and language.
import { getLanguage, onLanguageChange } from '../i18n.js';

export const LEGAL_PAGES = ['privacy', 'terms', 'guidelines', 'imprint', 'licenses'];
const pages = import.meta.glob(['./{privacy,terms,guidelines,imprint,licenses}.js', './zh/*.js']);

let seq = 0, active;
export async function showLegal(name){
  const root = document.querySelector('#scr-legal');
  if(!root || !LEGAL_PAGES.includes(name)) return;
  active = name;
  const body = root.querySelector('.scroll'), head = root.querySelector('h2');
  const mine = ++seq;
  head.textContent = '…'; body.textContent = '';
  const folder = getLanguage() === 'en' ? './' : './zh/';
  const page = await pages[folder + name + '.js']();
  if(mine !== seq) return;
  head.textContent = page.title;
  body.innerHTML = page.html();
  body.scrollTop = 0;
  if(page.mount) page.mount(body);
}

onLanguageChange(() => {
  if(active && document.querySelector('#scr-legal.on')) showLegal(active);
});
