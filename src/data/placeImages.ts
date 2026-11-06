export interface PlaceImage {
  src: string;
  alt: string;
  position: string;
  fit?: 'cover' | 'contain';
  zoomOrigin?: string;
}

// Personal travel photographs; crop only at display time, preserving the source files.
export const placeImages: Record<string, PlaceImage> = {
  dubai: {
    src: '/images/places/dubai.jpg',
    alt: '迪拜未来博物馆的环形建筑与书法外墙',
    position: '50% 50%',
  },
  baghdad: {
    src: '/images/places/baghdad.jpg',
    alt: '巴格达交叉双剑纪念建筑',
    position: '50% 60%',
  },
  istanbul: {
    src: '/images/places/istanbul.jpg',
    alt: '伊斯坦布尔清真寺与街道上的黄色出租车',
    position: '50% 65%',
  },
  tehran: {
    src: '/images/places/tehran.jpg',
    alt: '德黑兰自由塔与前方广场',
    position: '50% 65%',
  },
  'luang-prabang': {
    src: '/images/places/luang-prabang.jpg',
    alt: '琅勃拉邦河流、沿岸民居与远处山丘',
    position: '50% 65%',
  },
  vientiane: {
    src: '/images/places/vientiane.jpg',
    alt: '万象寺庙的多层屋顶与金色装饰',
    position: '50% 65%',
  },
  fiji: {
    src: '/images/places/fiji.jpg',
    alt: '斐济海滩、近岸小船与远处岛屿',
    position: '50% 65%',
  },
  rome: {
    src: '/images/places/Roma.jpg',
    alt: '罗马斗兽场与前方广场',
    position: '50% 65%',
  },
  vatican: {
    src: '/images/places/Vatican.jpg',
    alt: '梵蒂冈圣彼得大教堂、广场与方尖碑',
    position: '50% 55%',
  },
  florence: {
    src: '/images/places/Florence.jpg',
    alt: '俯瞰佛罗伦萨城区与圣母百花大教堂穹顶',
    position: '50% 65%',
  },
  milan: {
    src: '/images/places/Milano.jpg',
    alt: '米兰《最后的晚餐》壁画与所在展厅',
    position: '50% 50%',
  },
  munich: {
    src: '/images/places/Munchi.jpg',
    alt: '慕尼黑玛利亚广场的哥特式建筑立面',
    position: '50% 35%',
  },
  salzburg: {
    src: '/images/places/salzburg.jpg',
    alt: '萨尔茨堡河岸、桥梁与远处的教堂',
    position: '50% 50%',
  },
  vienna: {
    src: '/images/places/Vienna.jpg',
    alt: '维也纳宫殿建筑与前景雕像',
    position: '50% 50%',
  },
  bratislava: {
    src: '/images/places/Bratislava.jpg',
    alt: '布拉迪斯拉夫街头探出井盖的铜像',
    position: '50% 0%',
    zoomOrigin: '50% 0%',
  },
  budapest: {
    src: '/images/places/Budapest.jpg',
    alt: '多瑙河对岸灯光映照下的匈牙利国会大厦',
    position: '50% 60%',
  },
  belgrade: {
    src: '/images/places/belgrade.jpg',
    alt: '贝尔格莱德的建筑、旗杆与前方草坪',
    position: '50% 55%',
  },
  sarajevo: {
    src: '/images/places/Sarajevo.jpg',
    alt: '萨拉热窝河上的石拱桥与沿岸建筑',
    position: '50% 60%',
  },
  'kuala-lumpur': {
    src: '/images/places/Kuala%20Lumpur.jpg',
    alt: '吉隆坡苏丹阿都沙末大厦的钟楼与街景',
    position: '50% 20%',
    zoomOrigin: '50% 20%',
  },
  'bandar-seri-begawan': {
    src: '/images/places/Seri%20Begawan.jpg',
    alt: '透过矩形景框望向斯里巴加湾的金色穹顶清真寺',
    position: '50% 55%',
  },
  'kota-kinabalu': {
    src: '/images/places/kota%20kinabalu%20.jpg',
    alt: '哥打京那巴鲁海岸、码头与近海船只',
    position: '50% 65%',
  },
  'johor-bahru': {
    src: '/images/places/Johor%20Bahur.jpg',
    alt: '新山庙宇的彩色屋顶、庭院与雕塑',
    position: '50% 50%',
  },
  'siem-reap': {
    src: '/images/places/Siem%20Reap.jpg',
    alt: '暹粒吴哥古迹的石塔、廊柱与台阶',
    position: '50% 50%',
  },
  sihanoukville: {
    src: '/images/places/Sihanoukville.jpg',
    alt: '西哈努克港街头的大象雕塑',
    position: '50% 65%',
  },
  'phnom-penh': {
    src: '/images/places/Phnom%20Penh.jpg',
    alt: '金边夜色中灯光照亮的传统建筑',
    position: '50% 55%',
  },
  auckland: {
    src: '/images/places/Auckland.jpg',
    alt: '奥克兰天空塔与港湾沿岸建筑',
    position: '50% 50%',
  },
  sydney: {
    src: '/images/places/Sydney.jpg',
    alt: '从海湾对岸望向悉尼城市天际线',
    position: '50% 50%',
  },
  melbourne: {
    src: '/images/places/Melbourne.jpg',
    alt: '墨尔本旅行途中的海岸石柱、峭壁与海浪',
    position: '50% 50%',
  },
  adelaide: {
    src: '/images/places/adelaide.jpg',
    alt: '阿德莱德旅行中坐在树枝上的考拉',
    position: '50% 30%',
    zoomOrigin: '50% 30%',
  },
  'great-barrier-reef': {
    src: '/images/places/Great%20Barrier%20Reef.jpg',
    alt: '大堡礁旅行中的白色沙洲、碧蓝海水与远处岛屿',
    position: '50% 60%',
  },
  canberra: {
    src: '/images/places/Canberra.jpg',
    alt: '堪培拉湖畔的长椅、草地与远处山上的电信塔',
    position: '50% 50%',
  },
  irkutsk: {
    src: '/images/places/Irkutsk.jpg',
    alt: '伊尔库茨克旅行中的湖岸道路、建筑与远处雪山',
    position: '50% 25%',
  },
  'saint-petersburg': {
    src: '/images/places/Saint%20Petersburg.jpg',
    alt: '圣彼得堡冬宫的绿色立面、雕塑与金色穹顶',
    position: '50% 50%',
  },
  moscow: {
    src: '/images/places/Moscow.jpg',
    alt: '莫斯科河、桥梁与两岸的教堂和克里姆林宫塔楼',
    position: '50% 55%',
  },
};
