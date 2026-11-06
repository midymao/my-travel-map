export interface HighlightFeature {
  id?: string | number;
  properties?: { name?: string; code?: string; countryCode?: string; highlightType?: string };
  geometry?: { type: string; coordinates?: number[][][] | number[][][][] };
}

interface HighlightCountry {
  code: string;
  name?: string;
  drawBoundary?: boolean;
}

type CountryMap = Map<number, HighlightCountry>;

export function isProvinceHighlight(feature: HighlightFeature) {
  return feature.properties?.highlightType === 'province' && feature.properties.countryCode === 'CN';
}

export function buildHighlightPolygons(countries: HighlightFeature[], countryMap: CountryMap, provinces: HighlightFeature[]) {
  return [
    ...countries.filter(f => {
      const country = countryMap.get(Number(f.id));
      return country && country.code !== 'CN' && country.drawBoundary !== false;
    }),
    ...provinces.filter(f => isProvinceHighlight(f) && ['Polygon', 'MultiPolygon'].includes(f.geometry?.type ?? '')),
  ];
}

export function highlightCountryCode(feature: HighlightFeature, countries: CountryMap) {
  return isProvinceHighlight(feature) ? 'CN' : countries.get(Number(feature.id))?.code;
}

// Province polygons only mark the globe: they never open a directory or card.
export function clickableCountryCode(feature: HighlightFeature, countries: CountryMap) {
  return isProvinceHighlight(feature) ? undefined : countries.get(Number(feature.id))?.code;
}

export interface BoundarySegment {
  start: number[];
  end: number[];
  owners: Set<string>;
}

// Shared polygon edges have opposite directions. Canonical endpoints merge them
// before any glow is drawn, including the two representations of the dateline.
export function uniqueBoundarySegments(features: HighlightFeature[], countries: CountryMap) {
  const segments = new Map<string, BoundarySegment>();
  const point = (p: number[]) => [Number((((p[0] + 180) % 360 + 360) % 360 - 180).toFixed(6)), Number(p[1].toFixed(6))];
  for (const feature of features) {
    const coords = feature.geometry?.coordinates;
    if (!coords) continue;
    const polygons = feature.geometry!.type === 'Polygon' ? [coords as number[][][]] : coords as number[][][][];
    const owner = highlightCountryCode(feature, countries);
    for (const polygon of polygons) for (const ring of polygon) {
      for (let i = 1; i < ring.length; i++) {
        const a = point(ring[i - 1]), b = point(ring[i]);
        const ka = a.join(','), kb = b.join(',');
        if (ka === kb) continue;
        const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
        let segment = segments.get(key);
        if (!segment) {
          segment = { start: a, end: b, owners: new Set() };
          segments.set(key, segment);
        }
        if (owner) segment.owners.add(owner);
      }
    }
  }
  return [...segments.values()];
}
