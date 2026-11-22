// Community Guidelines — the rules for comments and shared isles.
import { STATIC_DEPLOYMENT } from '../deployment.js';
import { UPDATED, REPO, esc, contactLine, updatedLine, otherPages } from './shared.js';

export const title = 'Community Guidelines';
export const updated = UPDATED;

export const html = () => STATIC_DEPLOYMENT ? `
${updatedLine('2026-11-22')}
<p>When contributing to Brclio Klarbase, be respectful, keep feedback on topic and keep personal information out of public posts. Let other players discover solutions themselves. A spoiler-free hint is welcome.</p>
<p>To propose an isle or report a problem, follow the <a href="${esc(REPO)}/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener">contribution guide</a> or use the <a href="${esc(REPO)}/issues" target="_blank" rel="noopener">GitHub issue tracker</a>.</p>
${otherPages()}` : `
${updatedLine(UPDATED)}
<p>Brclio Klarbase is a place to share and solve puzzles. These few rules keep it that way. They apply to comments, isle names and anything else you share. They are part of the <a href="/terms" data-go="/terms">Terms of Use</a>.</p>

<h3>Be kind</h3>
<p>Say what you liked, or what could be clearer. No insults, harassment, hate or threats — about people or groups. Disagree about a puzzle, never about a person.</p>

<h3>Don't give away routes</h3>
<p>A solution is something a player earns. Comments must not contain routes, move strings, step-by-step walkthroughs or spoilers of the solution. The game checks for this and refuses such comments; trying to sneak one past it counts as breaking the rule. Hints like "look at the plate again" are fine.</p>

<h3>No links, spam or ads</h3>
<p>No links, promotion, referral codes, repeated or copy-pasted messages, or off-topic posts.</p>

<h3>Keep personal data out</h3>
<p>Don't post other people's personal information (names, addresses, emails, accounts, photos), and don't share your own more than you want to — comments are public and show your name and picture.</p>

<h3>Report, don't retaliate</h3>
<p>If something breaks these rules, use the report button and move on. Three reports from different people hide an item automatically, and the maintainer looks at them. Don't answer in kind, and don't report in bad faith.</p>

<h3>Consequences</h3>
<p>Depending on how serious or repeated it is: content is hidden or removed, commenting or sharing is limited, or the account is closed. If you think a decision was wrong, email AI悦创 at ${contactLine()}.</p>
${otherPages()}`;
