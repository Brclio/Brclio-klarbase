import { EVENTS } from '../analytics.js';
import { GITHUB_DEPLOYMENT, STATIC_DEPLOYMENT } from '../deployment.js';
import { REPO, contactLine, esc, updatedLine, otherPages } from './shared.js';

export const title = 'Privacy';
export const html = () => `
${updatedLine()}
<p>AI悦创 maintains Brclio Klarbase. You can play and build without signing in. This page explains where your game data goes and how to contact the maintainer about it.</p>
<h3>On your device</h3>
<p>Your browser stores your language, game settings, builder drafts, guest progress, Daily results, Sky Atlas exploration and the GitHub username you enter for contributions. You can clear these by removing this site’s data in your browser. Export any builder draft you want to keep first.</p>
${GITHUB_DEPLOYMENT ? `<h3>Signing in and syncing progress</h3>
<p>GitHub handles sign-in. Brclio stores your display name, avatar URL and an account ID derived from your provider ID. A temporary cookie protects the sign-in redirect. A session cookie keeps you signed in for up to seven days. The game stores the session token’s hash and its expiry. Signing out revokes the session.</p>
<p>Your account has a separate progress cache on each device. Stars, best results, Daily scores and Sky Atlas exploration sync to your account. Guest progress and builder drafts stay in your browser. Clearing browser data does not erase your cloud save.</p>
<h3>Public content</h3>
<p>Shared isles show your name. Comments show your name and avatar alongside what you write. Loading an avatar sends a request to the image host. Reports and rate-limit counters are linked to your account to prevent duplicate reports and limit abuse.</p>
<h3>Hosting and retention</h3>
<p>Cloudflare hosts the site and processes connection data, including IP addresses, to serve and protect it. The game does not send gameplay analytics. Brclio stores encrypted account, progress and community records in a private GitHub repository. When a record is changed or removed from the current version, earlier encrypted copies remain in Git history.</p>` : STATIC_DEPLOYMENT ? `<h3>Site delivery</h3>
<p>Cloudflare hosts the game and processes connection data such as your IP address to serve and protect the site. Progress and drafts stay on this device. This version uses no login or analytics cookies and sends no gameplay events to a game server.</p>` : `<h3>Accounts and game records</h3>
<p>The game server stores your login provider’s account link, name, email, avatar and sign-in tokens. A login cookie and a temporary redirect cookie support authentication. The session includes its expiry, starting IP address and browser information. Sessions expire after seven days of inactivity and end when you sign out.</p>
<p>Signing in lets the server save and merge your stars, best results, Daily scores and explored regions. Shared isles show your name. Comments show your name and avatar. Reports are linked to your account to prevent repeated reports. When you send feedback, the server stores your message, the page, any reply email you provide and, if signed in, your account.</p>
<h3>Play totals and usage analytics</h3>
<p>Starting, clearing, restarting or asking for a hint adds to anonymous totals for that isle. Clears also contribute moves and a time bucket. These totals contain no account, device identifier or IP address. Rate limiting can hold IP addresses in memory for up to an hour.</p>
<p>If usage analytics is enabled, the game sends the events listed below to PostHog’s EU service through a proxy that strips your IP address, cookies and sign-in information. Analytics uses an in-memory identifier during a visit and an opaque account ID when signed in. Do Not Track and Global Privacy Control disable it. You can change your choice below.</p>
<ul>${EVENTS.map(e => `<li><code>${esc(e.name)}</code>${e.props.length ? ` <small>(${e.props.map(esc).join(', ')})</small>` : ''} — ${esc(e.description)}</li>`).join('')}</ul>
<div class="legal-toggle" id="analyticsBox" style="margin:10px 0 4px"></div>`}
<h3>GitHub contributions and feedback</h3>
<p><a href="${REPO}/issues" target="_blank" rel="noopener">Project issues</a>, pull requests and accepted isles are public on GitHub. GitHub handles the account and activity associated with those submissions. Keep personal information out of public posts.</p>
<h3>Questions about your data</h3>
<p>To ask what data Brclio holds, request a correction or deletion, or raise a privacy concern, email the maintainer at ${contactLine()}. Include only enough information to identify the record. Do not send passwords or sign-in tokens.</p>
${otherPages()}`;

export { mount } from './privacy-controls.js';
