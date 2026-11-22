import { t } from '../i18n.js';

// Rich text here is authored by the game. No player input is interpolated.
const help = {
  move: [
    "Hop one tile per key. <b>↑ always means away from you</b> — turn the view with Q / E.",
    "每按一次方向键就跳一格。<b>↑ 始终朝屏幕远处移动</b>，按 Q / E 可旋转视角。",
  ],
  height: [
    "Stairs climb one level. You can hop <b>down</b> a ledge, but never climb one.",
    "走上斜坡可以升高一层。遇到断崖只能向<b>下</b>跳一层，无法直接往上爬。",
  ],
  crate: [
    "Walk into crates to push them. In water they sink and become stepping stones.",
    "朝木箱走就能推动它。把木箱推入水中，它会沉下去，变成可以踩的垫脚石。",
  ],
  ice: [
    "Ice keeps you sliding until something stops you — crates included.",
    "踏上冰面后会一直滑到遇上阻挡。推上冰面的木箱也会滑。",
  ],
  gate: [
    "Gates open while <b>every</b> plate is pressed, by you or a crate.",
    "只有当<b>所有</b>踏板都被压住时，栅门才会打开。你和木箱都可以压住踏板。",
  ],
  lever: [
    "Stand on a lever and press <b>Space</b>: every bridge flips. A crate on a sinking bridge stays as a block.",
    "站在拉杆上按<b>空格键</b>，所有浮桥都会切换升降状态。桥下沉时，桥上的木箱会留下来充当垫脚石。",
  ],
  arch: [
    "Keys open doors — one key each. Step into an arch ⛩ to appear at its twin.",
    "每把钥匙可以打开一扇门。走进传送拱门 ⛩，就会从配对的另一扇门出来。",
  ],
  scales: [
    "Sky Scales: two pans hang from one vine. The heavier pan sinks a level, the lighter rises one — and you ride along. You and crates weigh 1.",
    "天空天平的两只秤盘由藤蔓相连。较重的一侧下降一层，较轻的一侧上升一层。站上秤盘即可随它升降，你和木箱的重量都是 1。",
  ],
  balloon: [
    "Press <b>Space</b> on a post to take its balloon: you weigh nothing, can’t push or press plates, and a step off an edge becomes a <b>glide</b> — one level down per tile. Space again lets it go, forever.",
    "站在气球柱上按<b>空格键</b>拿起气球。此时重量为零，推不动木箱，也压不住踏板。从边缘迈出去即可<b>滑翔</b>，每前进一格下降一层。再按空格键就会放飞气球，无法取回。",
  ],
  stone: [
    "Space on a stone pile: carry a stone and weigh 2. It only goes back on a pile. You hold one thing at a time.",
    "站在石堆上按空格键可以拿起石头，使重量变成 2。石头只能放回石堆，每次只能拿一样东西。",
  ],
  buoy: [
    "Buoys weigh −1: they float <b>up</b> a step, never down, and float on water as stepping stones.",
    "浮标的重量是 −1，可以被推<b>上</b>一层台阶，却不能往下推。在水中它会浮起来，供你踩着通过。",
  ],
  gust: [
    "Vents blow light things (balloon-you, buoys) one tile after each move. A crate in the gust shelters what’s behind it. Only a stone lets you push into the wind.",
    "每走一步，风口会把轻物（拿着气球的你或浮标）吹动一格。木箱可以给后方挡风。要顶风推动物体，你得先拿一块石头。",
  ],
  seed: [
    "Seeds are optional — they’re off the short route.",
    "种子藏在最短路线之外，收不收集都可以通关。",
  ],
  hazards: [
    "Boulders roll their lane and thorn sweepers turn, one beat per move. Glowing rings show where they’ll be next. Get caught and Pip bonks — the move doesn’t count. <b>Space</b> waits a beat.",
    "滚石沿轨道移动，荆棘杆会旋转。你每走一步，它们就前进一拍。光圈标出下一拍的危险位置。撞上时，这一步不会计入步数。按<b>空格键</b>可以原地等待一拍。",
  ],
  map: [
    "Some maps have several isles. A gateway arch carries you between them; press <b>M</b> to see the whole map.",
    "有些地图由多座浮岛组成，跨岛拱门可以将你送到另一座浮岛。按 <b>M</b> 查看全图。",
  ],
  star: [
    "Reach the glowing star. Match par for ★★★. Stuck? <b>H</b> shows the isle’s tip, then your best next move.",
    "抵达发光的星星即可通关，用最少步数完成可得 ★★★。遇到困难时，按 <b>H</b> 先读本关提示，再按一次查看建议的下一步。",
  ],
  difficulty: [
    "Each isle shows a difficulty from <b>Breeze</b> to <b>Mythic</b>. ",
    "每座浮岛都会标出难度，从<b>入门</b>到<b>传说</b>。",
  ],
  atlasMove: [
    "Walk with <b>arrows / WASD</b> (or the d-pad) — <b>hold</b> a key to keep going. Stairs climb a level; ledges you can hop down, never up. Q / E turn the view.",
    "使用<b>方向键 / WASD</b>（或屏幕方向键）行走，<b>长按</b>即可连续移动。斜坡可以爬上一层，断崖只能向下跳。按 Q / E 旋转视角。",
  ],
  shrine: [
    "Every <b>shrine</b> (a little arch with a light column) holds an isle. Step onto it, then <b>Play</b>.",
    "每座<b>神龛</b>中都有一道浮岛谜题。找到发出光柱的小拱门，走上去后选择<b>挑战</b>。",
  ],
  beacon: [
    "Clear an isle and its shrine lights a <b>beacon</b>. Official, community, daily and wild isles all count.",
    "通关一座浮岛，对应的神龛就会亮起<b>信标</b>。官方、社区、每日和野生浮岛都可以点亮。",
  ],
  atlas: [
    "Press <b>M</b> for the Atlas page of everywhere you've seen. Drag and zoom it; <b>tap a lit star</b> to fly straight there.",
    "按 <b>M</b> 打开星图，查看已经探索过的地方。你可以拖动和缩放星图，<b>点亮起的星星</b>就能直接飞到那里。",
  ],
  signin: [
    "<b>Sign in</b> to earn access to the smart route.",
    "<b>登录账号</b>即可查看最短解法。",
  ],
  clear: [
    "<b>Clear the isle</b> — then compare your route with the smart one.",
    "<b>通关浮岛</b>后，可以对比自己的路线和最短路线。",
  ],
  effort: [
    "<b>Keep exploring</b> — time spent actually moving counts.",
    "<b>继续探索</b>，移动时长和步数达到下方目标即可解锁。",
  ],
  feedback: [
    "Ideas, bugs, an isle that felt unfair — it all goes straight to the maker.",
    "有想法、遇到故障，或是觉得某关不太公平？写下来，开发者会收到你的反馈。",
  ],
};
export const helpText = key => t(...help[key]);
