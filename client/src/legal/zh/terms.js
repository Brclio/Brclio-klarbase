import { GITHUB_DEPLOYMENT, STATIC_DEPLOYMENT } from '../../deployment.js';
import { UPDATED, REPO, esc, contactLine, updatedLine, authoritative, otherPages } from '../shared.js';

export const title = '使用条款';
export const html = () => GITHUB_DEPLOYMENT || STATIC_DEPLOYMENT ? `
${updatedLine('2026-11-22')}
<p>本游戏依照 <a href="${esc(REPO)}/blob/main/LICENSE" target="_blank" rel="noopener">MIT 许可证</a>按现状提供。你可以使用建造器的 <i>JSON</i> 功能备份自己的浮岛。</p>
<h3>贡献浮岛</h3>
<p>请提交你亲自制作或有权分享的浮岛。项目收录的浮岛将按 MIT 许可证发布，并为创作者署名。有关文件格式和审核流程，请参阅<a href="${esc(REPO)}/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener">贡献指南</a>。</p>
${GITHUB_DEPLOYMENT ? `<h3>分享与评论</h3>
<p>公开分享浮岛即表示你同意按 MIT 许可证发布它。Klarbase 会将你分享的浮岛、发表的评论与你的公开个人资料一同展示。请遵守<a href="/guidelines" data-go="/guidelines">社区守则</a>。本版本的数据存储方式见<a href="/privacy" data-go="/privacy">隐私政策</a>。</p>` : ''}
${otherPages()}` : `
${updatedLine(UPDATED)}
<p>本条款适用于你在 klarbase.dev 使用 Klarbase 的情形。游玩和创作无需账号，分享浮岛、发表评论和云端存档等功能需要登录。使用 Klarbase 即表示你同意本条款。</p>
<h3>1. 免费的业余项目</h3>
<p>Klarbase 是由一人独立维护的免费开源业余项目，<b>按现状</b>提供。我们不保证服务始终可用、完全无误或永久保留你的数据。功能可能调整或移除。请使用建造器中的<i>导出</i>功能备份你珍视的浮岛。</p>
<h3>2. 你创作的浮岛</h3>
<p>源代码及仓库中的浮岛均按 <a href="${esc(REPO)}/blob/main/LICENSE" target="_blank" rel="noopener">MIT 许可证</a>发布。在线分享浮岛或通过 GitHub 提交浮岛，即表示你按相同的 MIT 许可证发布它，游戏会显示你的创作者署名。请只分享你亲自制作或有权分享的浮岛。分享的浮岛按内容识别，内容相同的浮岛仅存储一份。</p>
<h3>3. 你的评论</h3>
<p>你保留对自己所写内容的权利。发布评论即表示，在评论保留期间，你授予 Klarbase 免费、全球范围、非独占的许可，以便存储评论，并在对应浮岛上向其他玩家展示评论、你的姓名和头像。你可以随时删除账号，评论也会一并移除，详见<a href="/privacy" data-go="/privacy">隐私政策</a>。</p>
<h3>4. 行为规范</h3>
<p>请友善交流、公平游玩。<a href="/guidelines" data-go="/guidelines">社区守则</a>是本条款的一部分。请勿攻击服务、试图绕过发布审核、以损害服务的频率抓取数据，或利用服务从事违法活动。</p>
<h3>5. 内容管理</h3>
<p>已登录的玩家可以举报浮岛和评论。三个不同的人举报同一内容后，系统会自动隐藏该内容。对于违反本条款、社区守则或法律的行为，维护者也可能移除内容、限制或关闭账号，并在可行时发出通知。如需书面举报或申诉，请联系${contactLine()}。</p>
<h3>6. 服务可用性与条款变更</h3>
<p>我们随时可能调整、暂停或终止 Klarbase 服务，也可能随时变更、暂停或终止本条款。发生重大条款变更时，我们会更新本页顶部的日期。此后继续使用即表示你接受新版条款。</p>
<h3>7. 责任</h3>
<p>如涉及故意或重大过失，对生命、身体或健康造成伤害，或法律强制要求承担责任（例如《产品责任法》），我们承担无限责任。因轻微过失违反提供服务所必需的核心合同义务时，我们的责任以免费服务通常可预见的损害为限。其他轻微过失违约情形不承担责任。你的法定权利不受影响。</p>
<h3>8. 适用法律与联系方式</h3>
<p>本条款适用德国法律，但不会剥夺你作为消费者依据居住国法律享有的保护，任何强制性的管辖规定也不受影响。如对本条款有疑问，请联系${contactLine()}，或参阅<a href="/imprint" data-go="/imprint">运营者信息</a>。</p>
${authoritative()}
${otherPages()}`;
