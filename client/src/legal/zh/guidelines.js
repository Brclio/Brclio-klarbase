import { STATIC_DEPLOYMENT } from '../../deployment.js';
import { UPDATED, REPO, esc, contactLine, updatedLine, otherPages } from '../shared.js';

export const title = '社区守则';
export const html = () => STATIC_DEPLOYMENT ? `
${updatedLine('2026-11-22')}
<p>参与 Brclio Klarbase 的社区交流时，请尊重他人，反馈时围绕主题，不要在公开帖子中留下个人信息。请让其他玩家自己发现解法。欢迎分享不剧透的提示。</p>
<p>想提交浮岛或报告问题，请参阅<a href="${esc(REPO)}/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener">贡献指南</a>，或前往 <a href="${esc(REPO)}/issues" target="_blank" rel="noopener">GitHub 问题区</a>。</p>
${otherPages()}` : `
${updatedLine(UPDATED)}
<p>我们希望每个人都能在 Brclio Klarbase 轻松游玩。以下规则适用于评论、浮岛名称和你分享的其他内容，也是<a href="/terms" data-go="/terms">使用条款</a>的一部分。</p>
<h3>友善交流</h3>
<p>可以聊聊你喜欢的地方，或指出哪里还可以更清楚。禁止侮辱、骚扰、仇恨言论和威胁，无论针对个人还是群体。对谜题有不同看法很正常，请勿攻击他人。</p>
<h3>给其他玩家留出解谜的乐趣</h3>
<p>玩家应有机会自己找到解法。评论中不能出现路线、按键序列、逐步攻略或透露解法的剧透。游戏会检查并拒绝此类评论，试图绕过检查也属于违规。“再看看那块踏板”这样的提示没有问题。</p>
<h3>禁止链接、刷屏或广告</h3>
<p>请勿发布链接、推广内容、推荐码、重复或复制粘贴的消息，以及与主题无关的帖子。</p>
<h3>保护个人信息</h3>
<p>请勿发布他人的姓名、地址、电子邮件、账号、照片等个人信息。评论会公开显示你的姓名和头像，请自行决定愿意公开哪些自己的信息。</p>
<h3>举报违规，避免争执</h3>
<p>看到违规内容，可以点击举报按钮，然后继续游戏。三个不同的人举报同一内容后，系统会自动将其隐藏，维护者随后会进行审核。请勿以同样的行为回击，也请勿恶意举报。</p>
<h3>违规处理</h3>
<p>根据违规的严重程度和发生次数，可能会隐藏或移除内容、限制评论或分享功能，或关闭账号。如果你认为处理有误，请联系${contactLine()}。</p>
${otherPages()}`;
