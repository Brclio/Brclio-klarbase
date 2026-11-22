// Sessions stay in server-managed, HTTP-only cookies in both deployments.
import { GITHUB_DEPLOYMENT, STATIC_DEPLOYMENT } from './deployment.js';
import { api } from './net.js';

const providers = { github:'https://github.com', google:'https://accounts.google.com' };
const knownProviders = [...Object.keys(providers), 'email'];
let providerNames = [];
let railwayAuth;

function railwayClient(){
  return railwayAuth ||= import('better-auth/client').then(({ createAuthClient }) => createAuthClient({ baseURL:'' }));
}

export const signInProviders = () => providerNames;

export async function loadAuthProviders(){
  if(!STATIC_DEPLOYMENT){
    const result = await api('/auth/providers');
    if(!Array.isArray(result.providers)) throw new Error('Sign-in is temporarily unavailable');
    providerNames = knownProviders.filter(provider => result.providers.includes(provider));
  }
  return signInProviders();
}

export async function getSession(){
  if(GITHUB_DEPLOYMENT) return api('/auth/get-session');
  try {
    const { data } = await (await railwayClient()).getSession();
    return data;                       // null when logged out
  } catch { return null; }
}

export async function signInWithEmail({ email, password, name }){
  if(!providerNames.includes('email')) throw new Error('Email sign-in is unavailable');
  const registering = name !== undefined;
  const body = { email:email.trim().toLowerCase(), password };
  if(registering) body.name = name.trim();
  const result = await api(registering ? '/auth/sign-up/email' : '/auth/sign-in/email', { method:'POST', body });
  if(!result?.user?.id) throw new Error('Could not start a session');
  return result.user;
}

export async function signIn(provider){
  if(!Object.hasOwn(providers, provider) || !providerNames.includes(provider)) throw new Error('This sign-in option is unavailable');
  const body = { provider, callbackURL:location.pathname + location.search + location.hash };
  if(GITHUB_DEPLOYMENT){
    const { url } = await api('/auth/sign-in/social', { method:'POST', body });
    if(!url || new URL(url).origin !== providers[provider]) throw new Error('Invalid sign-in redirect');
    location.assign(url);
  } else {
    const { error } = await (await railwayClient()).signIn.social({ provider, callbackURL:location.pathname });
    if(error) throw new Error(error.message || 'Sign-in is temporarily unavailable');
  }
}

export async function signOut(){
  if(GITHUB_DEPLOYMENT) return api('/auth/sign-out', { method:'POST' });
  const { error } = await (await railwayClient()).signOut();
  if(error) throw new Error(error.message || 'Could not sign out');
}
