// Sign-in modal — one place, so every feature that needs an account (the chip, comments,
// sharing, the solution lock) uses the configured providers.
// The last provider used is remembered on this device (`klarbase.v2.lastProvider`, a
// DEVICE key — never synced) and shown first as the primary button.
import { signIn, signInProviders } from './auth.js';

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
  return order.map((p, i) => `<button class="btn${i ? '' : ' primary'}" id="${p === 'github' ? 'siGh' : 'siGo'}" data-auth-provider="${p}">${prefix} ${PROVIDERS[p]}</button>`).join('');
}

// why = optional one-line reason shown above the benefits ("to comment on this isle")
export function openSignIn(why = ''){
  const buttons = signInButtons();
  const body = document.getElementById('modalBody');
  body.classList.remove('wide');
  body.innerHTML = `<h2>Sign in to Klarbase</h2>
    ${buttons ? `${why ? `<p class="facts" style="font-weight:700">${why}</p>` : ''}
    <div class="rules" style="margin:10px 0 14px">
      <div><span class="ico">☁</span><span>Your progress on every device</span></div>
      <div><span class="ico">💬</span><span>Comment on isles</span></div>
      <div><span class="ico">🌐</span><span>Share isles online</span></div>
    </div>
    <div class="row">${buttons}</div>
    <p class="facts" style="font-size:12.5px;font-weight:600;margin:12px 0 0">No account needed to play or build.</p>
    <p class="facts" style="font-size:12px;font-weight:600;margin:8px 0 0">By signing in you agree to the <a data-go='/terms' href="/terms" style="color:inherit">Terms</a> and <a data-go='/privacy' href="/privacy" style="color:inherit">Privacy policy</a>.</p>`
    : '<p class="facts">Sign-in is unavailable. You can still play and build isles.</p>'}`;
  document.getElementById('modal').classList.add('on');
}
