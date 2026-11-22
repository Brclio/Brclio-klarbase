// Language belongs to this browser, independently of the active player or their saved game.
const preference = 'klarbase.v2.language';
function initialLanguage() {
  try { return localStorage.getItem(preference) === 'en' ? 'en' : 'zh-CN'; }
  catch { return 'zh-CN'; }
}

let language = initialLanguage();
const listeners = new Set();
export const getLanguage = () => language;
export const t = (english, chinese) => language === 'en' ? english : chinese;

export function setLanguage(next) {
  if ((next !== 'zh-CN' && next !== 'en') || next === language) return;
  language = next;
  try { localStorage.setItem(preference, next); } catch { /* Keep the selection for this visit. */ }
  for (const listener of listeners) listener(next);
}

export function onLanguageChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
