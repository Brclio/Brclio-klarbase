import { BRCLIO_DEPLOYMENT } from '../../deployment.js';
import { UPDATED, REPO, esc, updatedLine, otherPages } from '../shared.js';
import { listDependencies } from '../dependencies.js';

export const title = '许可证与致谢';
export const html = () => `
${updatedLine(UPDATED)}
<h3>Klarbase</h3>
<p>本游戏、引擎、工具以及仓库中的浮岛均按 <a href="${esc(REPO)}/blob/main/LICENSE" target="_blank" rel="noopener">MIT 许可证</a>发布。玩家贡献的浮岛采用相同许可证，并为创作者署名。原项目由 <a href="https://github.com/TanmoyP/klarbase" target="_blank" rel="noopener">TanmoyP 和 Klarbase 贡献者</a>创作。</p>
<h3>浏览器端使用的软件库</h3>
${listDependencies(true)}
<h3>${BRCLIO_DEPLOYMENT ? '上游 Node.js 服务端使用的软件库' : '服务端使用的软件库'}</h3>
${listDependencies(false)}
<p>以上软件库各自的依赖及其许可证可在仓库的依赖锁定文件中查看。</p>
<h3>灵感来源</h3>
<p>Klarbase 的灵感来自 xikhar 的 <i>papertrails</i>（采用 MIT 许可证）。本项目借鉴了它的思路和技巧，没有使用它的代码或素材。</p>
<h3>美术与音效</h3>
<p>全部美术和音效均由代码生成，游戏不含模型、纹理、图片或音频文件。</p>
<h3>字体</h3>
<p>Fredoka 和 Nunito 均采用 SIL 开放字体许可证 1.1。两款字体通过 @fontsource 软件包随游戏提供，由本站加载。</p>
${otherPages()}`;
