import { EVENTS } from '../../analytics.js';
import { GITHUB_DEPLOYMENT, STATIC_DEPLOYMENT } from '../../deployment.js';
import { REPO, esc, contactLine, updatedLine, otherPages } from '../shared.js';

export const title = '隐私政策';
const eventDescriptions = {
  pageview:'打开了游戏的某个页面。只记录路径，例如 /isle/root-bridge，不含查询参数。',
  isle_start:'在一座浮岛上迈出了第一步。记录浮岛的来源和最少步数。',
  isle_clear:'完成了一座浮岛。记录来源、最少步数、实际步数和用时的大致区间。',
  hint:'请求了提示。',
  restart:'中途重新开始了一座浮岛。',
  builder_open:'打开了浮岛建造器。',
  share_online:'在线分享了一座浮岛。',
  propose_github:'选择在 GitHub 上提交浮岛，使用预填的拉取请求链接或下载文件。',
  sign_in:'通过 GitHub 或 Google 登录。',
  comment_post:'在浮岛上发表了评论。',
  map_enter:'打开了世界地图。',
  map_shrine_enter:'进入了地图上的一座神殿。记录神殿类型。',
  map_region:'进入了地图上的一个区域。记录区域主题。',
};
const eventsHtml = () => `<ul>${EVENTS.map(e => `<li><code>${esc(e.name)}</code>${e.props.length ? ` <small>（${e.props.map(esc).join('、')}）</small>` : ''} — ${esc(eventDescriptions[e.name] || e.description)}</li>`).join('')}</ul>`;

export const html = () => `
${updatedLine()}
<p>Brclio Klarbase 由 AI悦创维护。你可以直接游玩和建造浮岛，无需登录。本页说明游戏数据保存在何处，以及如何联系维护者处理个人数据。</p>
<h3>保存在设备上的数据</h3>
<p>浏览器会保存语言、游戏设置、建造器草稿、访客进度、每日浮岛成绩、天空星图探索记录，以及你为贡献浮岛而填写的 GitHub 用户名。清除此站点的浏览器数据即可移除这些记录。如果要保留草稿，请先在建造器中将它导出。</p>
${GITHUB_DEPLOYMENT ? `<h3>登录与进度同步</h3>
<p>GitHub 负责登录验证。Brclio 保存你的显示名称、头像地址，以及根据登录服务商的用户 ID 生成的游戏账号 ID。登录跳转时会使用临时 Cookie 保护这次请求。会话 Cookie 最长保持登录七天，游戏保存会话令牌的哈希值和到期时间。退出登录会撤销此次会话。</p>
<p>每台设备会单独缓存你的账号进度。星星、最佳成绩、每日浮岛成绩和天空星图探索记录会同步到账号，访客进度和建造器草稿保存在浏览器中。清除浏览器数据后，云存档仍会保留。</p>
<h3>公开内容</h3>
<p>在线分享的浮岛会显示你的署名，评论会同时展示评论内容、名字和头像。加载头像时，浏览器会向图片所在服务发送请求。举报记录和操作频率计数会关联到你的账号，用于防止重复举报和滥用。</p>
<h3>托管与保留期限</h3>
<p>Cloudflare 托管网站，并处理包括 IP 地址在内的连接数据，以便提供服务和安全防护。游戏不发送游玩行为分析数据。Brclio 将账号、进度与社区记录加密保存到私有 GitHub 仓库。记录更新或从当前版本删除后，Git 历史中仍保留加密的旧版本。</p>` : STATIC_DEPLOYMENT ? `<h3>网站服务</h3>
<p>Cloudflare 托管游戏，并处理 IP 地址等连接数据，以提供服务和安全防护。进度与草稿仅保存在当前设备。本版本不使用登录或分析类 Cookie，也不向游戏服务器发送游玩事件。</p>` : `<h3>账号与游戏记录</h3>
<p>游戏服务器保存登录服务商提供的账号关联信息、姓名、邮箱、头像和登录令牌。登录使用会话 Cookie 和临时跳转 Cookie。会话记录包括到期时间、开始登录时的 IP 地址和浏览器信息。连续七天未使用后会话到期，退出登录也会结束会话。</p>
<p>登录后，服务器会保存并合并星星、最佳成绩、每日浮岛成绩和已探索区域。分享的浮岛显示你的署名，评论显示名字和头像。举报记录与你的账号关联，以防重复举报。如果你提交反馈，服务器保存消息、所在页面、你自愿提供的回复邮箱，以及登录状态下的账号。</p>
<h3>游玩统计与使用情况分析</h3>
<p>开始挑战、通关、重新开始或请求提示时，服务器会更新对应浮岛的匿名累计数字。通关还会计入步数和大致用时区间。汇总数据不含账号、设备标识或 IP 地址。为限制请求频率，服务器可能在内存中暂存 IP 地址，最长一小时。</p>
<p>启用使用情况分析后，游戏会通过代理将下列事件发送到 PostHog 的欧盟服务。代理会移除 IP 地址、Cookie 和登录资料。分析使用仅在本次访问内有效的内存标识，登录后还会使用不含姓名和邮箱的账号 ID。浏览器启用“请勿跟踪”或“全球隐私控制”时，分析会关闭。你也可以在下方更改设置。</p>
${eventsHtml()}
<div class="legal-toggle" id="analyticsBox" style="margin:10px 0 4px"></div>`}
<h3>GitHub 贡献与反馈</h3>
<p>在 GitHub 上提交的<a href="${REPO}/issues" target="_blank" rel="noopener">项目反馈</a>、拉取请求和已收录的浮岛是公开的。GitHub 负责处理与这些提交相关的账号信息和活动记录。请勿在公开页面中填写个人资料。</p>
<h3>联系维护者处理个人数据</h3>
<p>如需了解 Brclio 保存了哪些数据，或请求更正、删除数据以及反映隐私问题，请发邮件至 ${contactLine()}。提供能定位相关记录的必要信息即可。请勿发送密码或登录令牌。</p>
${otherPages()}`;

export { mount } from '../privacy-controls.js';
