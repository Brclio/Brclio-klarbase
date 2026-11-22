import { UPDATED, operatorBlock, operatorConfigured, operator, esc, updatedLine, otherPages } from '../shared.js';

export const title = '运营者信息';
export const html = () => {
  const o = operator();
  return `
${updatedLine(UPDATED)}
<h3>依据德国《数字服务法》第 5 条公布的信息（Impressum）</h3>
${operatorBlock()}
<h3>联系方式</h3>
${operatorConfigured() ? `<p>电子邮箱：<a href="mailto:${esc(o.email)}">${esc(o.email)}</a></p>` : '<p>此版本尚未配置。</p>'}
<h3>内容负责人（德国《媒体国家条约》第 18 条第 2 款）</h3>
${operatorConfigured() ? `<p>${esc(o.name)}，地址同上。</p>` : '<p>此版本尚未配置。</p>'}
<h3>免责声明</h3>
<p>Klarbase 是一个免费的非商业业余项目。玩家创作的浮岛和评论属于作者自己的内容。如果你发现违法内容，请点击举报按钮或通过电子邮件告知我们，我们会及时核查。</p>
${otherPages()}`;
};
