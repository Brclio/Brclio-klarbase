import { REPO, updatedLine, otherPages } from './shared.js';
import { brandAttribution, listDependencies } from './dependencies.js';

export const title = 'Licences';
export const html = () => `
${updatedLine()}
<h3>Brclio Klarbase</h3>
<p>Brclio maintains this version of the game. The code, tools and isles in the <a href="${REPO}" target="_blank" rel="noopener">Brclio repository</a> are released under the MIT License. Community isles credit their makers.</p>
<p>The original game carries the notice “Copyright (c) 2026 TanmoyP and Klarbase contributors”. The <a href="${REPO}/blob/main/LICENSE" target="_blank" rel="noopener">project licence</a> includes the copyright and permission notices to retain when distributing copies.</p>
<h3>Brclio brand mark</h3>
<p>The site icons and share preview feature the mark from the <a href="${brandAttribution.kit}" target="_blank" rel="noopener">official Brclio brand kit</a>. Visual direction based on the <a href="${brandAttribution.design}" target="_blank" rel="noopener">Esther Design System</a>, © 2026 ESTHER不二 (esthersjw), licensed under <a href="${brandAttribution.licence}" target="_blank" rel="noopener">CC BY-NC-SA 4.0</a>.</p>
<p>When reusing visual material covered by this licence, retain the credit and licence link, identify changes, limit use to noncommercial purposes and share adaptations under the same licence. Use of the Brclio name and mark as brand identifiers is managed separately.</p>
<h3>Libraries</h3>
<p>The browser client includes the following libraries. Optional libraries load when the associated feature is enabled.</p>
${listDependencies(true)}
<p>The repository also includes server components that use:</p>
${listDependencies(false)}
<p>Additional dependency licences are recorded in the <a href="${REPO}/blob/main/package-lock.json" target="_blank" rel="noopener">package lock file</a>.</p>
<h3>Fonts, art and sound</h3>
<p>Fredoka and Nunito are bundled via @fontsource and served by this site under the SIL Open Font License 1.1. The game generates its scenery, characters and sound effects in code.</p>
${otherPages()}`;
