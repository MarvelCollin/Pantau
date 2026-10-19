import type { FeatureCollection } from 'geojson'

type Kind = 'country' | 'sea' | 'island' | 'city'

export const cities: [name: string, region: string, lon: number, lat: number][] = [
  ['Jakarta', 'DKI Jakarta', 106.83, -6.2],
  ['Surabaya', 'Jawa Timur', 112.75, -7.25],
  ['Bandung', 'Jawa Barat', 107.61, -6.92],
  ['Medan', 'Sumatera Utara', 98.67, 3.59],
  ['Semarang', 'Jawa Tengah', 110.42, -6.97],
  ['Makassar', 'Sulawesi Selatan', 119.43, -5.14],
  ['Palembang', 'Sumatera Selatan', 104.76, -2.98],
  ['Yogyakarta', 'DI Yogyakarta', 110.37, -7.8],
  ['Denpasar', 'Bali', 115.22, -8.65],
  ['Balikpapan', 'Kalimantan Timur', 116.83, -1.24],
  ['Pontianak', 'Kalimantan Barat', 109.33, -0.03],
  ['Manado', 'Sulawesi Utara', 124.84, 1.47],
  ['Banda Aceh', 'Aceh', 95.32, 5.55],
  ['Padang', 'Sumatera Barat', 100.35, -0.95],
  ['Kupang', 'Nusa Tenggara Timur', 123.6, -10.17],
  ['Ambon', 'Maluku', 128.18, -3.7],
  ['Jayapura', 'Papua', 140.72, -2.53],
  ['Nusantara', 'Kalimantan Timur', 116.7, -0.97],
]

const neighbours: [string, number, number][] = [
  ['Singapore', 103.82, 1.35],
  ['Kuala Lumpur', 101.69, 3.14],
  ['Manila', 120.98, 14.6],
  ['Darwin', 130.84, -12.46],
  ['Dili', 125.57, -8.56],
  ['Bangkok', 100.5, 13.75],
  ['Ho Chi Minh City', 106.66, 10.76],
  ['Port Moresby', 147.18, -9.44],
  ['Kuching', 110.35, 1.55],
  ['Davao', 125.6, 7.07],
]

const places: [Kind, string, number, number, number][] = [
  ['country', 'Indonesia', 117.2, -3.6, 1],
  ['country', 'Malaysia', 102.3, 4.6, 2],
  ['country', 'Philippines', 122.6, 12.2, 2],
  ['country', 'Australia', 134, -22, 2],
  ['country', 'Papua New Guinea', 145.2, -6.4, 3],
  ['country', 'Timor-Leste', 125.9, -8.85, 4],
  ['country', 'Thailand', 100.9, 15.6, 3],
  ['country', 'Vietnam', 107.8, 14.2, 3],
  ['country', 'Cambodia', 104.9, 12.6, 4],
  ['country', 'Myanmar', 96.4, 20.5, 4],
  ['country', 'Laos', 103.2, 19.2, 5],
  ['country', 'China', 112, 27, 4],
  ['country', 'India', 80, 22, 5],
  ['sea', 'Java Sea', 110.6, -4.9, 1],
  ['sea', 'Banda Sea', 127.2, -5.9, 1],
  ['sea', 'Celebes Sea', 122.6, 3.6, 1],
  ['sea', 'Arafura Sea', 135.5, -9.6, 1],
  ['sea', 'Flores Sea', 120.8, -7.6, 2],
  ['sea', 'Molucca Sea', 126.5, 0.6, 2],
  ['sea', 'South China Sea', 113.5, 10.5, 1],
  ['sea', 'Indian Ocean', 100, -13, 1],
  ['sea', 'Pacific Ocean', 142, 7, 1],
  ['sea', 'Timor Sea', 127.5, -11.5, 2],
  ['sea', 'Andaman Sea', 96.2, 10.5, 2],
  ['island', 'Sumatra', 101.6, -0.4, 1],
  ['island', 'Kalimantan', 113.8, 0.8, 1],
  ['island', 'Sulawesi', 120.3, -2.1, 1],
  ['island', 'Papua', 138.6, -4.3, 1],
  ['island', 'Java', 109.6, -7.45, 2],
]

export const overviewLabels: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    ...places.map(([kind, name, lon, lat, rank]) => ({ kind, name, lon, lat, rank })),
    ...cities.map(([name, , lon, lat]) => ({ kind: 'city' as const, name, lon, lat, rank: name === 'Jakarta' ? 1 : 2 })),
    ...neighbours.map(([name, lon, lat]) => ({ kind: 'city' as const, name, lon, lat, rank: 3 })),
  ].map((p) => ({
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] },
    properties: { kind: p.kind, name: p.name, rank: p.rank },
  })),
}
