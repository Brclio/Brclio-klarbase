// Sign-in modal — one place, so every feature that needs an account (the chip, comments,
// sharing, the solution lock) uses the configured providers.
// The last provider used is remembered on this device (`klarbase.v2.lastProvider`, a
// DEVICE key — never synced) and shown first as the primary button.
import { signIn, signInProviders } from './auth.js';
import { t } from './i18n.js';

const KEY = 'klarbase.v2.lastProvider';
const PROVIDERS = { github:'GitHub', google:'Google' };
const last = () => { try { const p = JSON.parse(localStorage.getItem(KEY)); return PROVIDERS[p] ? p : 'github'; } catch { return 'github'; } };

export async function startSignIn(provider){
  try { localStorage.setItem(KEY, JSON.stringify(provider)); } catch {}
  try { sessionStorage.setItem('klarbase.signin', provider); } catch {}   // hook(analytics): sign_in fires once after the OAuth return
  try { await signIn(provider); }
  catch(error){
    try { sessionStorage.removeItem('klarbase.signin'); } catch {}
    throw error;
  }
}

export function signInButtons(prefix = 'Continue with'){
  const available = signInProviders(), first = last();
  const order = available.includes(first) ? [first, ...available.filter(p => p !== first)] : available;
  return order.map((p, i) => `<button class="btn${i ? '' : ' primary'}" id="${p === 'github' ? 'siGh' : 'siGo'}" data-auth-provider="${p}">${t(prefix + ' ' + PROVIDERS[p], '使用 ' + PROVIDERS[p] + ' 登录')}</button>`).join('');
}

// why = optional one-line reason shown above the benefits ("to comment on this isle")
export function openSignIn(why = ''){
  const buttons = signInButtons();
  const body = document.getElementById('modalBody');
  body.classList.remove('wide');
  body.innerHTML = `<h2>${t('Sign in to Klarbase', '登录 Klarbase')}</h2>
    ${buttons ? `${why ? `<p class="facts" style="font-weight:700">${why}</p>` : ''}
    <div class="rules" style="margin:10px 0 14px">
      <div><span class="ico">☁</span><span>${t('Your progress on every device', '在不同设备上继续上次的进度')}</span></div>
      <div><span class="ico">💬</span><span>${t('Comment on isles', '在浮岛上留言')}</span></div>
      <div><span class="ico">🌐</span><span>${t('Share isles online', '在线分享你创作的浮岛')}</span></div>
    </div>
    <div class="row">${buttons}</div>
    <p class="facts" style="font-size:12.5px;font-weight:600;margin:12px 0 0">${t('No account needed to play or build.', '不用登录也能游玩和创作。')}</p>
    <p class="facts" style="font-size:12px;font-weight:600;margin:8px 0 0">${t('By signing in you agree to the ', '登录即表示你同意')}<a data-go='/terms' href="/terms" style="color:inherit">${t('Terms', '使用条款')}</a>${t(' and ', '和')}<a data-go='/privacy' href="/privacy" style="color:inherit">${t('Privacy policy', '隐私政策')}</a>${t('.', '。')}</p>`
    : `<p class="facts">${t('Sign-in is unavailable. You can still play and build isles.', '暂时无法登录。你仍然可以游玩和创作浮岛。')}</p>`}`;
  document.getElementById('modal').classList.add('on');
}
