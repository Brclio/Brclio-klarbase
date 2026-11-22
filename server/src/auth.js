// better-auth manages passwords, OAuth and session cookies for the optional Node service.
import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node';
import { prisma } from './db.js';

const socialProviders = {};
for(const name of ['github', 'google']){
  const clientId = process.env[name.toUpperCase() + '_CLIENT_ID'];
  const clientSecret = process.env[name.toUpperCase() + '_CLIENT_SECRET'];
  if(clientId && clientSecret) socialProviders[name] = { clientId, clientSecret };
}
export const signInProviders = ['email', ...Object.keys(socialProviders)];

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  baseURL: process.env.BETTER_AUTH_URL,          // e.g. http://localhost:3000
  secret: process.env.BETTER_AUTH_SECRET,        // openssl rand -hex 32
  emailAndPassword: { enabled:true, minPasswordLength:10, maxPasswordLength:128 },
  databaseHooks: {
    user: { create: {
      async before(user, ctx) {
        if(ctx?.path !== '/sign-up/email') return;
        const name = user.name.trim();
        if(!name || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name)) {
          throw new APIError('BAD_REQUEST', { message:'Invalid display name' });
        }
        // Distinguish email saves from the device cache used by existing OAuth players.
        const id = 'email_' + crypto.randomUUID().replaceAll('-', '');
        return { data:{ ...user, id, name, image:null } };
      },
    } },
    account: { create: {
      async before(account) {
        // Password registration does not verify ownership of the address reported by an OAuth provider.
        if(account.userId.startsWith('email_') && account.providerId !== 'credential') {
          throw new APIError('UNAUTHORIZED', { message:'Sign in with your email and password' });
        }
      },
    } },
  },
  socialProviders,
  trustedOrigins: [process.env.CLIENT_ORIGIN || 'http://localhost:5173'],
});

export const authHandler = toNodeHandler(auth.handler);

// The signed-in user for a request, or null. For public routes that only
// reveal extra detail (e.g. an isle's solution) to signed-in players.
export async function sessionUser(req){
  try {
    const s = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    return (s && s.user) || null;
  } catch { return null; }
}

// Middleware: anonymous visitors may play the bundled presets only — every API
// route behind this gate requires a logged-in user (Phase 2 gating rule).
export async function requireAuth(req, res, next){
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if(!session || !session.user) return res.status(401).json({ error:'login required' });
    req.user = session.user;
    next();
  } catch(e){
    res.status(401).json({ error:'login required' });
  }
}
