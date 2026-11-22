import { ERR, CURATED_ISLES } from '@klar/core';
import { getLanguage } from '../i18n.js';
import { gameText, isleName } from './game.js';

export const panelLabels = {
  '📖 How to build':'📖 建造指南', Name:'名称', Theme:'主题', 'Difficulty — your gut call':'难度 · 你的判断',
  'Start from':'从模板开始', '— keep my isle —':'— 保留当前浮岛 —', 'Fresh 7×7 meadow':'新建 7×7 草地',
  Size:'尺寸', 'right-click erases':'右键擦除', at:'位置', 'altitude ':'高度 ',
  '▶ Test it':'▶ 试玩', '✓ Deep check':'✓ 深度检查', '☁ Share online':'☁ 在线分享',
  'Isle code — the text format (edit me too)':'浮岛代码 · 可直接编辑', 'Contribute on GitHub':'在 GitHub 投稿',
  'Contribute to the official repo':'向官方仓库投稿', '⇪ Propose on GitHub':'⇪ 提交到 GitHub', '⤒ Import':'⤒ 导入',
};

const errors = {
  E_ROWS:'rows 必须是非空的字符串列表', E_SIZE:'浮岛的宽和长都不能超过 14 格', E_RAGGED:'每行的格数必须相同',
  E_TOKEN:'有无法识别的地块符号', E_START:'需要且只能有一个起点（S）', E_GOAL:'至少需要一个终点（G）',
  E_PORTAL:'拱门必须成对，每种拱门 p、q、r 各出现 0 次或 2 次', E_GATE:'栅门（D）至少需要一个踏板（o）',
  E_CRATES:'木箱与浮标合计最多 8 个', E_THEME:'无法识别这个主题',
  E_STOREYS:'storeys 需包含 1–3 座浮岛，每座都要有 rows 和 at 属性',
  E_AT:'每座岛的 at 需给出三个整数，x、z 范围是 0–40，高度范围是 0–24',
  E_OVERLAP:'平面位置重叠的浮岛高度须相差至少 8 级', E_V6:'这些地块只能用于群岛地图，请使用 schemaVersion 6 和 storeys',
  E_PANS:'天空天平需要两个秤盘，至少各放一格 a 和 b', E_PAN_H:'秤盘要升降一级，基础高度须为 1–4',
  E_PAN_PLAIN:'秤盘只能是普通地面，不能与水、冰、踏板、木箱、起点、终点或钥匙占同一格', E_SEEDS:'最多放 3 颗种子',
  E_GUSTS:'风路不能交叉或重叠，每格最多经过一道风', E_CYCLE:'机关要在 12 拍内重合。请缩短滚石轨道（最多 7 格），或减少机关种类',
  E_HAZARD_START:'皮普的起点处于机关危险范围内', E_HAZARD_LANE:'滚石轨道不能交叉或共用地块',
  E_HAZARD_PIECE:'木箱或浮标位于危险区，请将它移出滚石和荆棘臂的范围',
  E_SHAPE:'浮岛需要第 5 版 rows 格式，群岛需要第 6 版 storeys 格式', E_TIER:'请选择列表中的一个难度',
  E_TOO_BIG:'状态太多，无法完成验证。请缩小浮岛', E_UNSOLVABLE:'目前没有通往终点的路线',
};
const messages = {
  'id must be lowercase-words-with-dashes, up to 40 chars':'id 请使用小写英文单词，用短横线连接，最多 40 个字符。',
  'name must be 3–40 letters, numbers, spaces or simple punctuation':'名称需包含 3–40 个字母、数字、空格或允许的标点。',
  'author must be your GitHub username':'作者名请填写你的 GitHub 用户名。',
  'file must be a JSON object':'文件内容须为 JSON 对象。','par must be an integer':'par（最少步数）必须为整数。',
  'solution must be a string of U D L R X':'解法必须是由 U、D、L、R、X 组成的字符串。',
  'not solvable — no sequence of moves reaches a goal':'目前没有能到达终点的路线。',
  'solution has extra moves after the goal is reached':'解法在抵达终点后还有多余的步数。',
  'Walking straight toward the star wins — block the direct line so the way round is the way in.':'目前直奔星星就能过关。试试用障碍挡住直路，让玩家寻找绕行路线。',
  'No move can go wrong — put a crate near water or a ledge, where one careless push ruins the run.':'目前每个选择都能补救。可在水边或台阶边放个箱子，让玩家推之前仔细想想。',
  'The best route never steps away from the star — make the solution start by going the "wrong" way.':'目前最短路线一直朝向星星。可以试试让玩家先背向星星绕一步。',
  'Few positions to explore — a second crate or a lever multiplies the possibilities.':'布局可探索的状态不多。再加一个木箱或一根拉杆，可以增加选择。',
  'not found':'未找到这座浮岛。', 'login required':'请先登录。','Game storage temporarily unavailable':'暂时无法访问存储，请稍后重试。',
  'Isle verifier is unavailable':'关卡验证器暂时不可用，请稍后重试。','publish limit reached — 20 per hour':'每小时最多分享 20 次，请稍后再试。',
  'title required (max 60 chars)':'请输入名称，最多 60 个字符。','Failed to fetch':'网络连接失败，请重试。','server error':'服务暂时出错，请稍后再试。',
};
const parserErrors = Object.fromEntries(Object.entries(ERR).map(([code, text]) => [text, errors[code]]));
export function builderMessage(error){
  const text = typeof error === 'string' ? error : error?.text ?? '';
  if(getLanguage() === 'en') return text;
  if(errors[error?.code]) return errors[error.code];
  if(Object.hasOwn(parserErrors, text)) return parserErrors[text];
  if(Object.hasOwn(messages, text)) return messages[text];
  const coords = /^(.*?) \((?:storey (\d+), )?column (\d+), row (\d+)\)$/.exec(text);
  if(coords) return `${builderMessage(coords[1])}（${coords[2] ? '岛 ' + coords[2] + '，' : ''}第 ${coords[3]} 列，第 ${coords[4]} 行）`;
  const risky = /^Only (\d+) risky steps? /.exec(text);
  if(risky) return `最短路线上只有 ${risky[1]} 处容易走错。可以再安排一个需要考虑操作顺序的地方。`;
  const routes = /^(Many|\d+) shortest routes /.exec(text);
  if(routes) return `目前有${routes[1] === 'Many' ? '很多' : ' ' + routes[1] + ' 条'}最短路线。试试把它收束为一种巧解。`;
  const mismatch = /^You called it (\w+), but the audit reads (\w+)(.*?)\. Players will settle it either way\.$/.exec(text);
  if(mismatch) return `你选了「${gameText(mismatch[1])}」，求解器估计是「${gameText(mismatch[2])}」${mismatch[3] ? '，因为径直走向星星就能过关' : ''}。`;
  const short = /^too short: the best solution is (\d+) moves — a puzzle needs at least (\d+)$/.exec(text);
  if(short) return `最短解只有 ${short[1]} 步，社区投稿要求至少 ${short[2]} 步。`;
  if(text.startsWith('too large to verify')) return '状态太多，求解器无法在预算内完成验证，请缩小浮岛。';
  if(text.startsWith('the solution is plain flat walking')) return '最短路线需要用到至少一种机关，不能只是平地行走。';
  const duplicate = /^identical to an existing isle: (.*)$/.exec(text);
  if(duplicate){
    const official = CURATED_ISLES.find(doc => duplicate[1] === `official isle “${doc.name}”`);
    if(official) return `与官方浮岛《${isleName(official)}》完全相同。`;
    const community = /^community isle “(.*)” by @(.*)$/.exec(duplicate[1]);
    if(community) return `与 @${community[2]} 的社区浮岛《${community[1]}》完全相同。`;
    return '与已有浮岛完全相同，' + duplicate[1];
  }
  return text;
}
