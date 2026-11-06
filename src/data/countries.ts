// 两位字母代码 -> 地图数据用的数字代码。新增国家时在这里补一行。
export const numericByAlpha2: Record<string, number> = {
  FJ: 242, // 斐济
  AE: 784, // 阿联酋
  IQ: 368, // 伊拉克
  TR: 792, // 土耳其
  IR: 364, // 伊朗
  LA: 418, // 老挝
  IT: 380, // 意大利
  VA: 336, // 梵蒂冈
  DE: 276, // 德国
  AT: 40, // 奥地利
  SK: 703, // 斯洛伐克
  HU: 348, // 匈牙利
  RS: 688, // 塞尔维亚
  BA: 70, // 波斯尼亚和黑塞哥维纳
  MY: 458, // 马来西亚
  BN: 96, // 文莱
  KH: 116, // 柬埔寨
  RU: 643, // 俄罗斯
  CN: 156, // 中国
  PH: 608, // 菲律宾
  TH: 764, // 泰国
  AU: 36, // 澳大利亚
  NZ: 554, // 新西兰
  SG: 702, // 新加坡
};

// English state titles; leading articles omitted for compact tooltip labels.
// Sources: FCDO Geographical Names Index (July 2026), Vatican City State.
export const countryEnglishNames: Record<string, string> = {
  FJ: "Republic of Fiji",
  AU: "Commonwealth of Australia",
  AE: "United Arab Emirates",
  IQ: "Republic of Iraq",
  TR: "Republic of Türkiye",
  IR: "Islamic Republic of Iran",
  LA: "Lao People's Democratic Republic",
  IT: "Italian Republic",
  VA: "Vatican City State",
  DE: "Federal Republic of Germany",
  AT: "Republic of Austria",
  SK: "Slovak Republic",
  HU: "Hungary",
  RS: "Republic of Serbia",
  BA: "Bosnia and Herzegovina",
  MY: "Malaysia",
  BN: "Brunei Darussalam",
  KH: "Kingdom of Cambodia",
  NZ: "New Zealand",
  RU: "Russian Federation",
  CN: "People's Republic of China",
  PH: "Republic of the Philippines",
  TH: "Kingdom of Thailand",
  SG: "Republic of Singapore",
};

// Country presets also apply when city records are added later.
// Explicit views support small countries absent from the boundary dataset.
export const countryOnlyEntries = [
  { code: "CN", name: "中国", drawBoundary: false,
    view: { lat: 35, lng: 104, altitude: 1.5 } },
  { code: "PH", name: "菲律宾", drawBoundary: true,
    view: { lat: 12.5, lng: 122, altitude: 0.55 } },
  { code: "TH", name: "泰国", drawBoundary: true,
    view: { lat: 15.3, lng: 101, altitude: 0.5 } },
  { code: "AU", name: "澳大利亚", drawBoundary: true,
    view: { lat: -25.3, lng: 134, altitude: 1.4 } },
  { code: "SG", name: "新加坡", drawBoundary: true,
    view: { lat: 1.35, lng: 103.82, altitude: 0.045 } },
];
