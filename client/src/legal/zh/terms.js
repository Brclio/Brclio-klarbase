import { STATIC_DEPLOYMENT } from '../../deployment.js';
import { REPO, contactLine, updatedLine, otherPages } from '../shared.js';

export const title = '使用条款';
export const html = () => `
${updatedLine()}
<p>本条款适用于 AI悦创维护的 Brclio Klarbase。你可以免费游玩和建造浮岛，无需注册账号。想保留自己的作品，可以使用建造器的 JSON 导出功能备份。</p>
<h3>你创作的浮岛</h3>
<p>请只分享你亲自创作或有权分发的浮岛。向 Brclio 的项目仓库提交浮岛${STATIC_DEPLOYMENT ? '' : '或在游戏中公开发布浮岛'}，即表示你同意按 <a href="${REPO}/blob/main/LICENSE" target="_blank" rel="noopener">MIT 许可证</a>发布作品。项目收录的浮岛会为创作者署名。提交方法和审核流程见<a href="${REPO}/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener">贡献指南</a>。</p>
${STATIC_DEPLOYMENT ? '' : `<h3>分享与评论</h3>
<p>登录后可以在线分享浮岛或发表评论。分享的浮岛会显示你的署名。你保留对评论的权利，并允许 Brclio 存储评论，将评论连同你的名字和头像展示给其他玩家。你可以删除自己的评论。</p>
<p>请遵守<a href="/guidelines" data-go="/guidelines">社区守则</a>。三个不同的玩家举报同一座浮岛或同一条评论后，系统会将其隐藏。对处理结果有疑问，可联系 ${contactLine()}。账号和游戏记录的保存方式见<a href="/privacy" data-go="/privacy">隐私政策</a>。</p>`}
<h3>许可与服务可用性</h3>
<p>游戏软件按 MIT 许可证的约定依现状提供。我们无法保证在线服务始终可用或永久保留存档。对本条款有疑问，请发邮件至 ${contactLine()}。</p>
${otherPages()}`;
