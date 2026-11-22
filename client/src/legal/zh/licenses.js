import { REPO, updatedLine, otherPages } from '../shared.js';
import { brandAttribution, listDependencies } from '../dependencies.js';

export const title = '许可证与致谢';
export const html = () => `
${updatedLine()}
<h3>Brclio Klarbase</h3>
<p>本游戏版本由 Brclio 维护。<a href="${REPO}" target="_blank" rel="noopener">Brclio 项目仓库</a>中的代码、工具和浮岛均按 MIT 许可证发布，社区浮岛为创作者保留署名。</p>
<p>原始游戏的版权声明为「Copyright (c) 2026 TanmoyP and Klarbase contributors」。分发副本时应保留的版权和授权声明见<a href="${REPO}/blob/main/LICENSE" target="_blank" rel="noopener">项目许可证</a>。</p>
<h3>Brclio 品牌标识</h3>
<p>网站图标和分享预览图使用 <a href="${brandAttribution.kit}" target="_blank" rel="noopener">Brclio 官方品牌素材包</a>中的标识。Brclio 标识的视觉方向基于 <a href="${brandAttribution.design}" target="_blank" rel="noopener">Esther Design System</a>，© 2026 ESTHER不二（esthersjw），采用 <a href="${brandAttribution.licence}" target="_blank" rel="noopener">CC BY-NC-SA 4.0</a> 许可。</p>
<p>转用受此许可约束的视觉素材时，应保留署名与许可链接，注明所作修改，仅用于非商业目的，并按相同许可分享改编作品。Brclio 名称和标识的品牌使用另行管理。</p>
<h3>第三方软件库</h3>
<p>浏览器客户端使用以下软件库，其中的可选组件会在对应功能启用时加载。</p>
${listDependencies(true)}
<p>仓库中的服务端组件还使用以下软件库：</p>
${listDependencies(false)}
<p>其他依赖及其许可证记录在<a href="${REPO}/blob/main/package-lock.json" target="_blank" rel="noopener">依赖锁定文件</a>中。</p>
<h3>字体、美术与音效</h3>
<p>Fredoka 与 Nunito 字体按 SIL 开放字体许可证 1.1 分发，通过 @fontsource 随游戏打包，由本站提供。游戏中的场景、角色和音效均由代码生成。</p>
${otherPages()}`;
