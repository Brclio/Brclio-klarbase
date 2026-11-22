// Licences & credits. Library licences were read from each package's package.json
// (node_modules, versions as pinned in this release) — re-check when dependencies change.
import { BRCLIO_DEPLOYMENT } from '../deployment.js';
import { UPDATED, REPO, esc, updatedLine, otherPages } from './shared.js';
import { listDependencies } from './dependencies.js';

export const title = 'Licences';
export const updated = UPDATED;

export const html = () => `
${updatedLine(UPDATED)}
<h3>Klarbase</h3>
<p>The game, its engine, the tools and the isles in the repository are released under the <a href="${esc(REPO)}/blob/main/LICENSE" target="_blank" rel="noopener">MIT License</a>. Isles contributed by players are released under the same licence and credit their makers. Original project by <a href="https://github.com/TanmoyP/klarbase" target="_blank" rel="noopener">TanmoyP and Klarbase contributors</a>.</p>

<h3>Libraries sent to your browser</h3>
${listDependencies(true)}

<h3>${BRCLIO_DEPLOYMENT ? 'Libraries in the upstream Node.js server' : 'Libraries on the server'}</h3>
${listDependencies(false)}
<p>Each of these has its own dependencies, listed with their licences in the repository's lock file.</p>

<h3>Inspiration</h3>
<p>Klarbase was inspired by <i>papertrails</i> by xikhar (MIT licensed). We took ideas and techniques only — no code or assets.</p>

<h3>Art and sound</h3>
<p>All art and audio are generated in code. There are no model, texture, image or audio files.</p>

<h3>Fonts</h3>
<p>Fredoka and Nunito, both under the SIL Open Font License 1.1, are bundled with the game (via the @fontsource packages) and served by this site.</p>
${otherPages()}`;
