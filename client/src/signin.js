// Every feature that needs an account opens this dialog. Both sign-in methods use
// the server's session cookie. Only the choice of provider is kept on this device.
import { signIn, signInProviders, signInWithEmail } from './auth.js';
import { t } from './i18n.js';

const KEY = 'klarbase.v2.lastProvider';
const SOCIAL = { github:'GitHub', google:'Google' };
let submittingEmail = false;
const waitingForAccount = () => t('An account request is in progress. Please wait.', '账号请求正在处理中，请稍候。');
function remember(provider){
  try { localStorage.setItem(KEY, JSON.stringify(provider)); } catch {}
}
export async function startSignIn(provider){
  if(submittingEmail) throw new Error(waitingForAccount());
  remember(provider);
  try { sessionStorage.setItem('klarbase.signin', provider); } catch {}
  try { await signIn(provider); }
  catch(error){
    try { sessionStorage.removeItem('klarbase.signin'); } catch {}
    throw error;
  }
}

export function signInButtons(prefix = 'Continue with'){
  const available = signInProviders();
  let first = 'github';
  try { first = JSON.parse(localStorage.getItem(KEY)) || first; } catch {}
  const order = available.includes(first) ? [first, ...available.filter(p => p !== first)] : available;
  return order.map((provider, i) => {
    const css = 'btn' + (i ? '' : ' primary');
    if(provider === 'email') return `<button class="${css}" type="button" data-email-auth>${t('Email sign-in / register', '邮箱登录 / 注册')}</button>`;
    return `<button class="${css}" id="${provider === 'github' ? 'siGh' : 'siGo'}" data-auth-provider="${provider}">${t(prefix + ' ' + SOCIAL[provider], '使用 ' + SOCIAL[provider] + ' 登录')}</button>`;
  }).join('');
}

function emailFields(registering){
  return `<form id="accountForm" method="post">
    ${registering ? `<div class="field"><label for="accountName">${t('Public display name', '公开昵称')}</label>
      <input id="accountName" name="name" autocomplete="nickname" maxlength="80" required></div>` : ''}
    <div class="field"><label for="accountEmail">${t('Email', '邮箱')}</label>
      <input id="accountEmail" name="email" type="email" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="254" required></div>
    <div class="field"><label for="accountPassword">${t('Password', '密码')}</label>
      <input id="accountPassword" name="password" type="password" maxlength="128" required ${registering ? 'minlength="10" autocomplete="new-password" aria-describedby="passwordHint"' : 'autocomplete="current-password"'}>
      ${registering ? `<small id="passwordHint">${t('Use 10–128 characters.', '请输入 10–128 个字符。')}</small>` : ''}</div>
    <p class="auth-error" role="alert"></p>
    <button class="btn primary" type="submit">${registering ? t('Create account', '注册账号') : t('Sign in', '登录')}</button>
  </form>
  <button class="auth-switch" type="button">${registering ? t('Already registered? Sign in', '已有账号？去登录') : t('New here? Create an account', '还没有账号？立即注册')}</button>`;
}

function errorMessage(status, registering){
  if(status === 401) return t('Check your email and password and try again.', '邮箱或密码有误，请重试。');
  if(registering && (status === 422 || status === 409)) return t('This email is already registered. Sign in to continue.', '这个邮箱已经注册过了，请使用已有账号登录。');
  if(status === 429) return t('Too many attempts. Try again later.', '尝试次数过多，请稍后再试。');
  if(status === 400) return registering
    ? t('Check your display name, email and password.', '请检查昵称、邮箱和密码。')
    : t('Check your email and password.', '请检查邮箱和密码。');
  return t('Could not reach the account service. Please try again.', '暂时无法连接账号服务，请稍后重试。');
}

export function openEmailSignIn({ onSignedIn, close }){
  const modal = document.getElementById('modal');
  const body = document.getElementById('modalBody');

  const opener = document.querySelector('#authchip button');
  function dismiss(){
    close();
    if(opener?.isConnected) opener.focus();
  }
  function render(registering, emailValue = ''){
    body.classList.remove('wide');
    body.innerHTML = `<section class="auth-panel" role="dialog" aria-modal="true" aria-labelledby="accountTitle">
      <button class="auth-close" type="button" aria-label="${t('Close', '关闭')}">×</button>
      <h2 id="accountTitle" tabindex="-1">${registering ? t('Create an account', '注册账号') : t('Sign in with email', '邮箱登录')}</h2>
      ${emailFields(registering)}
      <p class="auth-terms">${t('By continuing, you agree to the ', '继续即表示你同意')}<a data-go="/terms" href="/terms">${t('Terms', '使用条款')}</a>${t(' and ', '和')}<a data-go="/privacy" href="/privacy">${t('Privacy policy', '隐私政策')}</a>${t('.', '。')}</p>
    </section>`;
    modal.classList.add('on');
    const panel = body.querySelector('.auth-panel');
    const error = panel.querySelector('.auth-error');
    const form = panel.querySelector('form');
    panel.querySelector('.auth-close').onclick = dismiss;
    panel.onkeydown = event => {
      if(event.key === 'Escape'){
        event.stopPropagation(); dismiss();
      } else if(event.key === 'Tab'){
        const controls = panel.querySelectorAll('button:enabled,input:enabled,a[href]');
        const end = controls[event.shiftKey ? 0 : controls.length - 1];
        if(document.activeElement === end){
          event.preventDefault();
          controls[event.shiftKey ? controls.length - 1 : 0].focus();
        }
      }
    };
    form.elements.email.value = emailValue;
    panel.querySelector('.auth-switch').onclick = () => render(!registering, form.elements.email.value);
    form.onsubmit = async event => {
      event.preventDefault();
      if(submittingEmail){ error.textContent = waitingForAccount(); return; }
      const data = Object.fromEntries(new FormData(form));
      if(registering && !data.name.trim()){
        error.textContent = t('Enter a display name for your isles and comments.', '请填写公开昵称，用于浮岛和评论署名。');
        form.elements.name.focus(); return;
      }
      submittingEmail = true;
      setBusy(true);
      try {
        const user = await signInWithEmail(data);
        form.reset();
        remember('email');
        try { sessionStorage.removeItem('klarbase.signin'); } catch {}
        onSignedIn(user);
      } catch(e){ error.textContent = errorMessage(e.status, registering); }
      finally { submittingEmail = false; setBusy(false); }
    };
    function setBusy(busy){
      for(const control of panel.querySelectorAll('input, button:not(.auth-close)')) control.disabled = busy;
      panel.setAttribute('aria-busy', String(busy));
      if(busy) error.textContent = '';
    }
    panel.querySelector('#accountTitle').focus();
  }
  render(false);
}

// why = optional one-line reason shown above the benefits ("to comment on this isle")
export function openSignIn(why = ''){
  const buttons = signInButtons();
  const body = document.getElementById('modalBody');
  body.classList.remove('wide');
  body.innerHTML = `<h2>${t('Sign in to Brclio Klarbase', '登录 Brclio Klarbase')}</h2>
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
