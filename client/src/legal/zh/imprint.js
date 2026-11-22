import { BRAND_URL, MAINTAINER_URL, PERSONAL_URL, SITE_URL } from '../../deployment.js';
import { REPO, contactLine, updatedLine, otherPages } from '../shared.js';

export const title = '项目与联系';
export const html = () => `
${updatedLine()}
<h3>Brclio Klarbase</h3>
<p><a href="${SITE_URL}">Brclio Klarbase</a> 是 Brclio 的免费开源解谜游戏，由 <a href="${MAINTAINER_URL}" target="_blank" rel="noopener">黄家宝（AI悦创，@AndersonHJB）</a>维护。你可以访问 <a href="${BRAND_URL}" target="_blank" rel="noopener">Brclio 品牌网站</a>或<a href="${PERSONAL_URL}" target="_blank" rel="noopener">AI悦创的个人网站</a>，也可以在 <a href="${REPO}" target="_blank" rel="noopener">GitHub 上查看 Brclio 的项目仓库</a>。</p>
<h3>联系维护者</h3>
<p>游戏反馈和功能建议可以提交到 <a href="${REPO}/issues" target="_blank" rel="noopener">Brclio 的公开问题区</a>。隐私请求、内容处理申诉或其他涉及个人信息的事项，请发邮件至 ${contactLine()}。</p>
<p>如果你发现安全问题，请提交<a href="${REPO}/security/advisories/new" target="_blank" rel="noopener">私密安全报告</a>，或发邮件至 ${contactLine()}。遇到不合适的浮岛或评论，可以使用游戏中的举报按钮。</p>
${otherPages()}`;
