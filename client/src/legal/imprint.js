import { BRAND_URL, MAINTAINER_URL, PERSONAL_URL, SITE_URL } from '../deployment.js';
import { REPO, contactLine, updatedLine, otherPages } from './shared.js';

export const title = 'Project and contact';
export const html = () => `
${updatedLine()}
<h3>Brclio Klarbase</h3>
<p><a href="${SITE_URL}">Brclio Klarbase</a> is a free, open-source puzzle game maintained by <a href="${MAINTAINER_URL}" target="_blank" rel="noopener">黄家宝 (AI悦创, @AndersonHJB)</a> for Brclio. Visit <a href="${BRAND_URL}" target="_blank" rel="noopener">Brclio</a>, <a href="${PERSONAL_URL}" target="_blank" rel="noopener">AI悦创’s website</a> or the <a href="${REPO}" target="_blank" rel="noopener">Brclio project on GitHub</a>.</p>
<h3>Contact the maintainer</h3>
<p>For game feedback and feature requests, use <a href="${REPO}/issues" target="_blank" rel="noopener">Brclio’s public issue tracker</a>. For privacy requests, moderation appeals or other matters involving personal information, email ${contactLine()}.</p>
<p>Report a security problem using the <a href="${REPO}/security/advisories/new" target="_blank" rel="noopener">private security report form</a> or email ${contactLine()}. In the game, use the report button for inappropriate shared content.</p>
${otherPages()}`;
