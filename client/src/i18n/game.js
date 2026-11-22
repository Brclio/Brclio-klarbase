// Presentation only. The editor, contribution files and solver keep their original data.
import { t } from '../i18n.js';

const vocabulary = {
  Jungle:'丛林', Oasis:'绿洲', Tropical:'热带', Urban:'城市', Mountain:'山地', Night:'月夜',
  Canopy:'树冠', Mirage:'海市蜃楼', Lagoon:'潟湖', Rooftops:'屋顶', Summit:'峰顶',
  'Hanging Gardens':'空中花园', Windward:'迎风之地', Nightfall:'夜幕', Confluence:'交汇之地',
  'Not sure':'暂不确定', Breeze:'入门', Easy:'简单', Tricky:'巧妙', Hard:'困难', Fiendish:'极难', Mythic:'传说',
  Fancy:'精致', Cozy:'均衡', Fast:'流畅',
  'Mossy roots, fireflies and slow green light.':'树根覆着青苔，萤火在林间柔和的绿光里闪动。',
  'Warm sand, turquoise springs and shimmering arches.':'暖沙环抱着碧泉，拱门在热浪中闪烁。',
  'Bright reefs, tidal bridges and drifting petals.':'珊瑚礁色彩明亮，花瓣随潮水漂过浮桥。',
  'Dusky rooftops, canal locks and warm window light.':'暮色落在屋顶与运河水闸上，窗里透出暖光。',
  'Crisp snow, glassy ice and pine-scented wind.':'新雪、镜面般的冰，还有带着松香的风。',
  'Moonlit isles, rolling boulders and thorny sweepers — cozy, never cruel.':'在月光下的浮岛上，留心滚石和转动的荆棘。',
  'Sky Scales and gateways: isles on vines, weighed against each other.':'藤蔓把浮岛连成天空天平，穿过拱门，在两端调配重量。',
  'Balloons, stones, buoys and gusts: what Pip carries decides where Pip can go.':'有气球、石块、浮标和阵风。皮普手里拿着什么，就决定了它能去哪里。',
  'Rolling boulders and thorn sweepers move one beat per move. Read the rings, wait a beat, never get bonked.':'皮普每走一步，滚石和荆棘就前进一拍。看清预告光圈，必要时等一拍。',
  'Where two chapters meet: light both constellations to open each isle.':'两章在这里交汇。点亮两边的星座，就能解锁它们共同的浮岛。',
  Ground:'地面', Flowers:'花地', Rock:'岩石', Tree:'树木', Water:'水面', Ice:'冰面', Ramp:'坡道',
  Crate:'木箱', Plate:'踏板', Gate:'栅门', Lever:'拉杆', Bridge:'浮桥', 'Sunk br.':'沉桥', Key:'钥匙',
  Door:'锁门', 'Arch A':'拱门 A', 'Arch B':'拱门 B', 'Arch C':'拱门 C', Start:'起点', Goal:'终点',
  Erase:'擦除', Raise:'升高', Lower:'降低', 'Pan A':'秤盘 A', 'Pan B':'秤盘 B', Balloon:'气球',
  Stones:'石堆', Buoy:'浮标', Vent:'风口', Seed:'种子', 'Boulder ↔':'横滚石', 'Boulder ↕':'纵滚石', Thorns:'荆棘',
  'walk:ramp':'走坡道','walk:down':'跳下台阶',push:'推箱',sink:'填水',gate:'开栅门',tp:'拱门传送',
  toggle:'切换浮桥',key:'拾钥匙',door:'开锁门',fall:'木箱坠落',slide:'冰上滑行',cslide:'木箱滑行',
  scales:'天空天平',gateway:'跨岛传送',glide:'滑翔',gust:'阵风',float:'漂浮',take:'拿起',drop:'放下',
  release:'放走气球',wait:'等待',hazard:'避开机关',
};
export const gameText = value => t(value, Object.hasOwn(vocabulary, value) ? vocabulary[value] : value);

// These ids belong to the bundled catalogue. Callers display online titles, drafts and player text directly.
const isles = {
  'first-steps':['初次启程','坡道只通向箭头所指的方向。找找哪条坡道朝着终点。'],
  'ledge-drop':['跳下石台','皮普能跳下一级台阶，却爬不上去。试试高处的路。'],
  'mossy-crate':['青苔木箱','把木箱推入水中，它会沉下去，变成垫脚石。先把木箱对准缺口。'],
  'root-bridge':['树根桥','木箱也能被推出台阶。先想好要让它落在哪里。'],
  'fern-gate':['蕨叶栅门','所有踏板同时被压住，栅门才会打开。你自己只能站在一处。'],
  'spring-lock':['泉边机关','两块踏板，三个木箱。有的木箱得离开原位。'],
  'mirage':['海市蜃楼','走进一扇拱门，你会从与它成对的另一扇出来。'],
  'twin-mirages':['双重幻境','这里有两对拱门。试着安排穿过它们的先后顺序。'],
  'sunken-well':['沉井','穿过拱门后，想办法自己搭一条过水的路。'],
  'palm-plates':['棕榈踏板','一块踏板留给木箱，一块由你压住。自己站在离栅门近的那块。'],
  'revolving-arch':['回环拱门','亲自踩踏板能开门，前提是你能一直留在那里。'],
  'tide-lever':['潮汐拉杆','站在拉杆上按「使用」，所有浮桥都会切换。'],
  'low-tide':['退潮时分','每次切换，一座浮桥升起，另一座沉下。多想两次切换。'],
  'coconut-key':['椰林钥匙','每扇锁门都要一把钥匙，有些钥匙则要先架桥才能拿到。'],
  'lagoon-locks':['潟湖之锁','两把钥匙，三扇锁门。其中一扇是陷阱。'],
  'sunken-step':['下沉的踏脚石','浮桥下沉时，桥上的木箱会留在原处。'],
  'rooftops':['屋顶漫步','清理走道，但别把木箱推到待会儿自己必经的地方。'],
  'canal-lift':['运河升降桥','两座桥得同时能走。浮桥沉下时，上面的木箱会留在原地垫脚。'],
  'subway':['地下通路','穿过拱门去拿钥匙，再借拱门回家。'],
  'night-market':['夜市','这边一块踏板，拱门另一头还有一块。木箱过不了拱门，你却可以。'],
  'crosswalk':['交叉路口','两个木箱，两块踏板。小心，很多方向都会把木箱推进死角。'],
  'street-drop':['落向街巷','木箱能掉下屋顶，却再也回不到高处。'],
  'first-frost':['初霜','踏上冰面就会一直滑行。岩石可以帮你刹住。'],
  'glacier-stops':['冰川停靠点','每次滑行都由岩石挡停。先选好下一处落脚点。'],
  'snowball':['雪球','需要挡住滑行的地方没有岩石？试试带一个木箱过去。'],
  'glacier-maze':['冰川迷宫','数数停靠点，最短路线要来回转弯。'],
  'frozen-gate':['冰封栅门','借冰面的滑力，把木箱推到踏板上。'],
  'the-peak':['登顶','一路学过的机关，都汇集在这座山上。'],
  'frost-ferry':['冰霜渡口','在冰上推出木箱之前想清楚，它要碰到障碍才停。'],
  'counterweight':['配重','光是你站上去，近处的秤盘就会下沉。先给另一端加点重量。'],
  'high-arch':['高处的拱门','木箱过不了拱门。动身前，先安排好远端秤盘的配重。'],
  'three-storeys':['三层浮岛','最上层的秤盘与最下层的秤盘一升一降。'],
  'own-weight':['自身的重量','一个木箱足以抬起桥，直到你自己走上去。你和一个木箱一样重。'],
  'the-crane':['起重架','单靠推力抬不起木箱。先把木箱放在秤盘上，再给另一端加重。'],
  'spend-a-crate':['舍弃一个木箱','第一个落水的木箱会一直留在泉里。让它沉在有用的位置。'],
  'garden-lift':['花园升降台','下层只有一个木箱能够上秤盘。找出是哪一个，以及从哪里推。'],
  'sky-scales':['天空天平','给下层浮岛加重，让上层浮岛升起。'],
  'lift-off':['起飞','站在气球桩上按「使用」取走气球，然后从边缘迈出去。'],
  'let-it-go':['放手','拿着气球时重量为零，连踏板也压不下。'],
  'heavy-heart':['沉甸甸的心','拿着石块时，你的重量是 2。上天平前，先到石堆拿一块。'],
  'buoy-bay':['浮标湾','浮标能飘上木箱爬不上的一级台阶，还能浮在水上。'],
  'glide-or-push':['滑翔还是推箱','拿着气球时，皮普太轻，什么也推不动。'],
  'tailwind':['顺风','拿着气球没法迎风走。先想办法挡住风。'],
  'ballast':['压舱石','浮标会把秤盘往上提。皮普和一个浮标合起来，重量正好是零。'],
  'drift':['漂流','风会带走浮标。木箱若挡在风路上，它后面便成了避风处。'],
  'brace':['顶风前行','拿着石块才够重，能顶风推东西。想腾出手，就把石块放回石堆。'],
  'windward':['迎风而行','起点越高就能滑得越远，先看看秤盘的高度。'],
  'wait-a-beat':['等一拍','光圈会标出滚石下一拍的位置。按空格等一拍。'],
  'sweeper':['旋转荆棘','荆棘臂沿直线伸出两格。它两次扫过的方向之间，对角线上的格子是安全的。'],
  'in-its-wake':['紧随其后','紧跟滚石前进，趁它折返之前找个凹处躲一躲。'],
  'lever-lane':['拉杆小径','拉一次杆也要用掉一拍，滚石可不会停下来等。'],
  'bramble-bridge':['荆棘桥','荆棘臂能扫到的地方都不能推入木箱，即使那里是水也一样。'],
  'needles-eye':['穿过针眼','滚石的轨道和荆棘的范围内都不能放木箱。找找两者之间的那道缝。'],
  'frost-mirage':['霜中幻境','在冰上滑进拱门时，只有皮普能穿到另一头。'],
  'drowned-gangway':['水下栈桥','两个木箱，各有分工：一个作配重，一个当踏脚石。'],
  'squall-line':['风暴前线','在冰上很难恰好停在心仪的位置，而风还会再推你一程。'],
};
const contributed = {
  'community/TanmoyP/sundial-steps': {
    name:['Sundial Steps', '日晷阶梯'],
    hint:['The arch drops you on the wrong side of the spring. Make your own way home.', '拱门会把你送到泉水的另一侧。试着自己搭一条回家的路。'],
  },
  'daily/TanmoyP/daily-2026-10-20': {
    name:['Tipping Pass', '倾盘山口'],
    hint:['To ride a pan up, its partner has to end up heavier than you.', '要乘秤盘上升，另一端最后必须比你更重。'],
    catch:["Load the near pan first, so the deep pan rises within a crate's reach. Then stand on the near pan and shove its crate across: the weight swings both ways at once and lifts you to the star.",
      '先给近处的秤盘配重，让深处的秤盘抬到木箱够得着的高度。再站上近端，把木箱推过去。两端同时改变重量，将你托向星星。'],
  },
};
function localizedField(doc, key, index, source){
  const english = doc?.[key];
  if(!english) return english;
  if(source === 'official') return t(english, isles[doc.id]?.[index] ?? english);
  const pair = contributed[`${source}/${doc.author}/${doc.id}`]?.[key];
  return pair && pair[0] === english ? t(...pair) : english;
}
export const isleName = (doc, source = 'official') => localizedField(doc, 'name', 0, source);
export const isleHint = (doc, source = 'official') => localizedField(doc, 'hint', 1, source);
export const isleCatch = (doc, source = 'official') => localizedField(doc, 'catch', 2, source);
