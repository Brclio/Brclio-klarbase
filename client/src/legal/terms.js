import { STATIC_DEPLOYMENT } from '../deployment.js';
import { REPO, contactLine, updatedLine, otherPages } from './shared.js';

export const title = 'Terms of Use';
export const html = () => `
${updatedLine()}
<p>These terms cover Brclio Klarbase, maintained by AI悦创. You can play and build isles for free without an account. Keep a copy of any isle you want to preserve using the builder’s JSON export.</p>
<h3>Your isles</h3>
<p>Share isles that you created or have permission to distribute. When you submit an isle to Brclio’s repository${STATIC_DEPLOYMENT ? '' : ' or publish it in the game'}, you release it under the <a href="${REPO}/blob/main/LICENSE" target="_blank" rel="noopener">MIT License</a>. Accepted contributions credit their makers. The <a href="${REPO}/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener">contribution guide</a> explains how to submit an isle and how it is reviewed.</p>
${STATIC_DEPLOYMENT ? '' : `<h3>Sharing and comments</h3>
<p>Sign in to share isles or write comments. Shared isles display your name. You keep the rights to your comments and allow Brclio to store them and show them to other players with your name and avatar. You can delete your own comments.</p>
<p>Follow the <a href="/guidelines" data-go="/guidelines">community guidelines</a>. Three different players reporting the same isle or comment will hide it. To ask about a moderation decision, contact ${contactLine()}. The <a href="/privacy" data-go="/privacy">privacy policy</a> explains how account and game records are kept.</p>`}
<h3>Licence and availability</h3>
<p>The game software is provided as is under the MIT License. Service availability and online storage are not guaranteed. For questions about these terms, email ${contactLine()}.</p>
${otherPages()}`;
