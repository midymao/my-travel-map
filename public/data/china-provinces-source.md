# 中国省级高亮数据

- 来源：GeoJSON.CN 的天地图省级边界数据。
- 来源说明：https://geojson.cn/data/atlas/tiandi
- 原始数据：https://geojson.cn/api/tiandi/0.3.0/100000.topo.json
- 原始坐标系：CGCS2000（EPSG:4490），以经纬度绘制到球面。
- 原始版权信息：Copyright (c) 2025 GeoJSON.CN。
- 本地文件：`china-provinces.geo.json`，仅包含指定的 18 个省级地区。

未包含完整中国轮廓、独立国境线、其他省级地区或目录数据。共享边界弧段统一简化，避免相邻地区产生不同的省界；香港使用更细的简化精度。环方向已按球面多边形要求规范化。

如需重新生成，下载原始数据后执行：

```sh
node scripts/prepare-china-provinces.mjs <原始数据文件路径>
```
