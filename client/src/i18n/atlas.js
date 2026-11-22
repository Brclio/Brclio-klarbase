import { t } from '../i18n.js';

const regions = {
  'Canopy Rise':'树冠高地', Fernhollow:'蕨谷', Mossmere:'苔泽', Greenwhisper:'绿语林', Tanglewood:'藤蔓林', Dewfall:'落露坡',
  'Mirage Flats':'蜃景原', 'Palm Reach':'棕榈长滩', Sunwell:'日光井', 'Dune Hollow':'沙丘谷', 'Amber Basin':'琥珀盆地', 'Cinder Springs':'余烬泉',
  'Lagoon Shallows':'潟湖浅滩', 'Coral Run':'珊瑚水道', Tideglass:'琉璃潮', 'Parrot Cove':'鹦鹉湾', 'Sandbar Sound':'沙洲海峡', 'Kelp Meadow':'海草原',
  'Rooftop Row':'屋顶街', 'Lantern Ward':'灯笼坊', 'Chimney Heights':'烟囱高地', 'Market Terrace':'集市露台', 'Skybridge Quarter':'天桥街区', 'Clocktower Hill':'钟楼山',
  Frostfold:'霜谷', 'Snowcap Reach':'雪顶原', 'Glacier Steps':'冰川阶梯', Windbluff:'风崖', 'Pinnacle Rest':'峰顶驿站', 'Icewater Peak':'冰泉峰',
  Moonwake:'月影湾', 'Starlit Hollow':'星光谷', 'Firefly Deep':'流萤幽境', 'Dusk Garden':'暮色花园', 'Lantern Dark':'幽灯林', Owlwatch:'夜枭哨所',
};

// Wild names are generated from two words by @klar/core. Only the UI calls this
// for generated isles, so player-authored titles are never run through this table.
const prefixes = {
  Mossy:'青苔', Fern:'蕨叶', Dewy:'晨露', Tangled:'藤蔓', Sunlit:'日照', Leafy:'绿叶', Hidden:'隐秘', Quiet:'静谧',
  Golden:'金色', Shimmering:'微光', Dusty:'风沙', Amber:'琥珀', Sleepy:'浅眠', Warm:'暖阳', Distant:'远方', Palmy:'棕榈',
  Sandy:'细沙', Coral:'珊瑚', Breezy:'微风', Salty:'海盐', Turquoise:'碧蓝', Lazy:'悠然', Sunny:'晴光', Shell:'贝壳',
  Lantern:'灯火', Brick:'红砖', Chimney:'烟囱', Clock:'时钟', Paper:'纸灯', Copper:'赤铜', Rainy:'细雨',
  Frosty:'霜白', Snowy:'白雪', Windy:'长风', Crystal:'水晶', Silent:'无声', Glassy:'琉璃', Pale:'淡色', Icy:'寒冰',
  Moonlit:'月光', Starry:'星辰', Hushed:'幽静', Glowing:'萤光', Drowsy:'梦乡', Velvet:'丝绒', Silver:'银色', Dim:'幽暗',
};
const places = {
  Hollow:'幽谷', Glade:'林间空地', Canopy:'树冠', Thicket:'灌木丛', Brook:'小溪', Clearing:'草坪', Perch:'栖木', Root:'树根',
  Well:'水井', Dune:'沙丘', Spring:'泉', Mirage:'蜃景', Caravan:'商队', Pool:'池', Arch:'拱门', Wadi:'河谷',
  Cove:'小湾', Lagoon:'潟湖', Shoal:'浅滩', Reef:'礁', Tide:'潮汐', Key:'小岛', Inlet:'海湾', Drift:'漂流地',
  Alley:'小巷', Rooftop:'屋顶', Courtyard:'庭院', Terrace:'露台', Crossing:'路口', Market:'集市', Stair:'阶梯', Yard:'院落',
  Ridge:'山脊', Slide:'滑道', Pass:'山口', Col:'山坳', Ledge:'岩台', Peak:'山峰', Shelf:'岩架',
  Meadow:'草甸', Lantern:'灯笼', Path:'小径', Garden:'花园', Owl:'猫头鹰',
};

export const regionName = name => t(name, regions[name] || name);
export function wildName(name) {
  const [prefix, place] = name.split(' ');
  return t(name, prefixes[prefix] && places[place] ? prefixes[prefix] + places[place] : name);
}
