// Edit the introduction, quotation and journal here. Images stay optional.
export interface ResidencePage {
  title: string;
  titleLines: string[];
  subtitle: string;
  quotationArt?: 'sichuan';
  quotationBackground?: string;
  heroImage: {
    src: string; alt: string; position?: string;
    fit?: 'cover' | 'contain'; scale?: number;
    brightness?: number; contrast?: number; opacity?: number;
  } | null;
  introduction: string[];
  quotation: { text: string; author: string; work: string; source: string; language?: 'en' | 'zh-CN' } | null;
  sections: { title: string; paragraphs: string[] }[];
}

export const yangtzeDeltaPage: ResidencePage = {
  title: 'Yangtze Delta Metropolitan',
  titleLines: ['Yangtze Delta', 'Metropolitan'],
  subtitle: '长三角大都会',
  heroImage: {
    src: '/images/residences/yangtze.delta.metropolitan.jpg',
    alt: '长三角水岸建筑、云层与水面倒影',
    position: '75% 55%',
    brightness: 1.16,
    contrast: 0.9,
    opacity: 0.9,
  },
  introduction: [
    '长江三角洲大型都市区，是以上海直辖市为核心，苏州、杭州为区域中心，围绕太湖流域的大型城市群，并辐射至苏北、浙南及皖南。该区域以强劲的出口导向型经济，创新驱动型发展、产业集聚与民营经济闻名。是中国最大、经济最发达、人类发展指数最高的区域。东南形胜，三吴都会，钱塘自古繁华。在浙江，杭嘉湖平原、杭绍甬经济走廊、温州和义乌市场经济构筑了该省为中国大陆第四经济大省与人均可支配收入第一大省。'
  ],
  quotation: {
    text: 'Beyond dispute the finest and the noblest in the world.',
    author: 'Marco Polo, on Hangzhou',
    work: 'The Travels of Marco Polo',
    source: 'https://afe.easia.columbia.edu/main_pop/ps/ps_china-polo-short.htm',
  },
  sections: [
    { title: '正文标题', paragraphs: ['正文内容待补充。'] },
  ],
};

export const sichuanBasinPage: ResidencePage = {
  title: 'Sichuan Basin',
  titleLines: ['Sichuan', 'Basin'],
  subtitle: '四川盆地',
  quotationArt: 'sichuan',
  quotationBackground: '/images/residences/sichuan-quotation-background.png',
  heroImage: {
    src: '/images/residences/sichuan.basin.jpg',
    alt: '黑色背景中探出头部的小猪',
    position: '50% 50%',
    fit: 'contain',
    scale: 0.86,
    opacity: 0.9,
  },
  introduction: [
    '四川，亦称蜀。是以成都为核心的中国西南区域大省。四川盆地位于巫山、巴山及横断山脉之间。南毗云贵，西接青藏，北窥关中。益州险塞，沃野千里，天府之土。大熊猫和火锅使这里成为中国大陆在国际上知名度最高的地区之一。',
  ],
  quotation: {
    text: '九天开出一成都，万户千门入画图。',
    author: '李白',
    work: '上皇西巡南京歌十首·其二',
    source: 'https://www.gushiwen.cn/mingju/juv_145dce2c8f0e.aspx',
    language: 'zh-CN',
  },
  sections: [{ title: '正文标题', paragraphs: ['正文内容待补充。'] }],
};

export const henanProvincePage: ResidencePage = {
  title: 'Henan Province',
  titleLines: ['Henan', 'Province'],
  subtitle: '河南省',
  heroImage: {
    src: '/images/residences/henan-wheatfield.jpg',
    alt: '河南麦田中的劳作人群、林带与远处山脉',
    position: '75% 65%',
  },
  introduction: [
    '河南省，中华文明的主要发源地，是中国户籍人口第一大省。位于中国大陆中央，是历代王朝定都之地，古称中原。与鲁、冀、晋合称山河四省，是中国中部地区最重要的省份。河南省既是粮食供应大省，也是劳动力输出大省。',
  ],
  quotation: {
    text: 'Ancient capitals rose and fell in Hénán’s north, where the capricious Yellow River (Huáng Hé) nourished the flowering of a great civilisation.',
    author: 'Lonely Planet',
    work: 'China',
    source: 'https://www.asiaphotos.org/CHINA/PROVINCES/HENAN/LIBRARY/Chapter%2015%20-%20Henan.pdf',
    language: 'en',
  },
  quotationBackground: '/images/residences/henan-quotation-background.png',
  sections: [{ title: '正文标题', paragraphs: ['正文内容待补充。'] }],
};

export const easternAustraliaPage: ResidencePage = {
  title: 'Eastern Australia',
  titleLines: ['Eastern', 'Australia'],
  subtitle: '东澳大利亚',
  heroImage: {
    src: '/images/residences/eastern.australia%20(2).jpg',
    alt: '东澳大利亚蓝天下的湖畔草地、树木与远处山上的高塔',
    position: '65% 60%',
  },
  introduction: [
    '东澳大利亚，指的是澳大利亚东部的沿海地区。贯穿南北的大分水岭阻隔了湿润的水气，使这里成为大洋洲最主要的人口聚居区域。著名的大堡礁沿漫长的海岸线分布，独特的有袋类动物在此处生存。阳光与海滩是这里最令人留恋的风景。',
  ],
  quotation: {
    text: 'so far as we know [it] doth not produce any one thing that can become an Article in trade to invite Europeans to fix a settlement upon it',
    author: 'James Cook, 1770',
    work: 'Journal · Account of New South Wales Coast',
    source: 'https://www.gutenberg.net.au/ebooks/e00043.html',
    language: 'en',
  },
  sections: [{ title: '正文标题', paragraphs: ['正文内容待补充。'] }],
};
