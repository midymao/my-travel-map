// Example covers use existing personal photos until dedicated country covers are supplied.
// Other countries fall back to their first available city photograph.
// Example: CN: { src: "/images/countries/CN.jpg", position: "50% 50%" }
export const countryAlbumCovers: Record<string, { src: string; position?: string; zoomOrigin?: string }> = {
  AU: { src: '/images/places/Great%20Barrier%20Reef.jpg', position: '50% 60%' },
};

export interface CountryAlbumPhoto {
  src: string;
  position?: string;
  zoomOrigin?: string;
  aspectRatio: number;
  cityId: string;
}

// Homepage-only photo stacks; city detail photographs remain independent.
export const countryAlbumDecks: Record<string, { photos: CountryAlbumPhoto[] }> = {
  AT: {
    photos: [
      { src: '/images/countries/_optimized/AT/salzburg-01.webp', aspectRatio: 3024 / 4032, cityId: 'salzburg' },
      { src: '/images/countries/_optimized/AT/salzburg-02.webp', aspectRatio: 4032 / 3024, cityId: 'salzburg' },
      { src: '/images/countries/_optimized/AT/vienna-01.webp', aspectRatio: 4032 / 3024, cityId: 'vienna' },
      { src: '/images/countries/_optimized/AT/vienna-02.webp', aspectRatio: 4032 / 3024, cityId: 'vienna' },
      { src: '/images/countries/_optimized/AT/vienna-03.webp', aspectRatio: 3024 / 4032, cityId: 'vienna' },
    ],
  },
  VA: {
    photos: [
      { src: '/images/countries/_optimized/VA/vatican-01.webp', aspectRatio: 4032 / 3024, cityId: 'vatican' },
      { src: '/images/countries/_optimized/VA/vatican-02.webp', aspectRatio: 3024 / 4032, cityId: 'vatican' },
      { src: '/images/countries/_optimized/VA/vatican-03.webp', aspectRatio: 4032 / 3024, cityId: 'vatican' },
    ],
  },
  HU: {
    photos: [
      { src: '/images/countries/_optimized/HU/budapest-01.webp', aspectRatio: 4032 / 3024, cityId: 'budapest' },
      { src: '/images/countries/_optimized/HU/budapest-02.webp', aspectRatio: 2591 / 4032, cityId: 'budapest' },
      { src: '/images/countries/_optimized/HU/budapest-03.webp', aspectRatio: 4032 / 3024, cityId: 'budapest' },
    ],
  },
  IQ: {
    photos: [
      { src: '/images/countries/_optimized/IQ/baghdad-01.webp', aspectRatio: 4032 / 3024, cityId: 'baghdad' },
      { src: '/images/countries/_optimized/IQ/baghdad-02.webp', aspectRatio: 3024 / 4032, cityId: 'baghdad' },
      { src: '/images/countries/_optimized/IQ/baghdad-03.webp', aspectRatio: 2537 / 1903, cityId: 'baghdad' },
      { src: '/images/countries/_optimized/IQ/baghdad-04.webp', aspectRatio: 4032 / 3024, cityId: 'baghdad' },
    ],
  },
  LA: {
    photos: [
      { src: '/images/countries/_optimized/LA/vientiane-01.webp', aspectRatio: 3024 / 4032, cityId: 'vientiane' },
      { src: '/images/countries/_optimized/LA/vientiane-02.webp', aspectRatio: 3870 / 2903, cityId: 'vientiane' },
      { src: '/images/countries/_optimized/LA/vientiane-03.webp', aspectRatio: 4032 / 3024, cityId: 'vientiane' },
      { src: '/images/countries/_optimized/LA/luang-prabang-01.webp', aspectRatio: 4032 / 3024, cityId: 'luang-prabang' },
      { src: '/images/countries/_optimized/LA/luang-prabang-02.webp', aspectRatio: 4032 / 3024, cityId: 'luang-prabang' },
    ],
  },
  RS: {
    photos: [
      { src: '/images/countries/_optimized/RS/belgrade-01.webp', aspectRatio: 3 / 4, cityId: 'belgrade' },
      { src: '/images/countries/_optimized/RS/belgrade-02.webp', aspectRatio: 3 / 4, cityId: 'belgrade' },
      { src: '/images/countries/_optimized/RS/belgrade-03.webp', aspectRatio: 3 / 4, cityId: 'belgrade' },
    ],
  },
  SK: {
    photos: [
      { src: '/images/countries/_optimized/SK/bratislava-01.webp', aspectRatio: 4 / 3, cityId: 'bratislava' },
      { src: '/images/countries/_optimized/SK/bratislava-02.webp', aspectRatio: 3 / 4, cityId: 'bratislava' },
    ],
  },
  BA: {
    photos: [
      { src: '/images/countries/_optimized/BA/sarajevo-01.webp', aspectRatio: 4 / 3, cityId: 'sarajevo' },
      { src: '/images/countries/_optimized/BA/sarajevo-02.webp', aspectRatio: 3 / 4, cityId: 'sarajevo' },
      { src: '/images/countries/_optimized/BA/sarajevo-03.webp', aspectRatio: 3 / 4, cityId: 'sarajevo' },
    ],
  },
  TR: {
    photos: [
      { src: '/images/countries/_optimized/TR/istanbul-01.webp', aspectRatio: 4 / 3, cityId: 'istanbul' },
      { src: '/images/countries/_optimized/TR/istanbul-02.webp', aspectRatio: 2915 / 3540, cityId: 'istanbul' },
      { src: '/images/countries/_optimized/TR/istanbul-03.webp', aspectRatio: 4 / 3, cityId: 'istanbul' },
      { src: '/images/countries/_optimized/TR/istanbul-04.webp', aspectRatio: 4 / 3, cityId: 'istanbul' },
    ],
  },
  IR: {
    photos: [
      { src: '/images/countries/_optimized/IR/tehran-01.webp', aspectRatio: 3 / 4, cityId: 'tehran' },
      { src: '/images/countries/_optimized/IR/tehran-02.webp', aspectRatio: 2671 / 2003, cityId: 'tehran' },
      { src: '/images/countries/_optimized/IR/tehran-03.webp', aspectRatio: 4 / 3, cityId: 'tehran' },
      { src: '/images/countries/_optimized/IR/tehran-04.webp', aspectRatio: 4 / 3, cityId: 'tehran' },
    ],
  },
  IT: {
    photos: [
      { src: '/images/countries/_optimized/IT/rome-01.webp', aspectRatio: 4 / 3, cityId: 'rome' },
      { src: '/images/countries/_optimized/IT/rome-02.webp', aspectRatio: 4 / 3, cityId: 'rome' },
      { src: '/images/countries/_optimized/IT/florence-01.webp', aspectRatio: 4 / 3, cityId: 'florence' },
      { src: '/images/countries/_optimized/IT/florence-02.webp', aspectRatio: 3 / 4, cityId: 'florence' },
      { src: '/images/countries/_optimized/IT/milan.webp', aspectRatio: 3 / 4, cityId: 'milan' },
    ],
  },
  AE: {
    photos: [
      { src: '/images/countries/_optimized/AE/cover.webp', aspectRatio: 4 / 3, cityId: 'dubai' },
      { src: '/images/countries/_optimized/AE/stack-01.webp', aspectRatio: 3 / 4, cityId: 'dubai' },
      { src: '/images/countries/_optimized/AE/stack-02.webp', aspectRatio: 3 / 4, cityId: 'dubai' },
      { src: '/images/countries/_optimized/AE/stack-03.webp', aspectRatio: 3 / 4, cityId: 'dubai' },
    ],
  },
  FJ: {
    photos: [
      { src: '/images/countries/_optimized/FJ/cover.webp', position: '50% 55%', aspectRatio: 4 / 3, cityId: 'fiji' },
      { src: '/images/countries/_optimized/FJ/stack-01.webp', aspectRatio: 4 / 3, cityId: 'fiji' },
      { src: '/images/countries/_optimized/FJ/stack-02.webp', aspectRatio: 3 / 4, cityId: 'fiji' },
      { src: '/images/countries/_optimized/FJ/stack-03.webp', aspectRatio: 3 / 2, cityId: 'fiji' },
    ],
  },
  AU: {
    photos: [
      { src: '/images/countries/_optimized/AU/sydney.webp', position: '50% 35%', aspectRatio: 4 / 3, cityId: 'sydney' },
      { src: '/images/countries/_optimized/AU/melbourne.webp', aspectRatio: 3 / 4, cityId: 'melbourne' },
      { src: '/images/countries/_optimized/AU/adelaide.webp', position: '50% 30%', aspectRatio: 4 / 3, cityId: 'adelaide' },
      { src: '/images/countries/_optimized/AU/canberra.webp', aspectRatio: 3 / 4, cityId: 'canberra' },
      { src: '/images/countries/_optimized/AU/great-barrier-reef.webp', position: '50% 60%', aspectRatio: 4 / 3, cityId: 'great-barrier-reef' },
    ],
  },
};
