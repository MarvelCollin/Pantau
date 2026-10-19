export const AIRLINES: Record<string, { name: string; iata: string }> = {
  GIA: { name: 'Garuda Indonesia', iata: 'GA' },
  CTV: { name: 'Citilink', iata: 'QG' },
  LNI: { name: 'Lion Air', iata: 'JT' },
  BTK: { name: 'Batik Air', iata: 'ID' },
  WON: { name: 'Wings Air', iata: 'IW' },
  SJV: { name: 'Super Air Jet', iata: 'IU' },
  AWQ: { name: 'Indonesia AirAsia', iata: 'QZ' },
  SJY: { name: 'Sriwijaya Air', iata: 'SJ' },
  NAM: { name: 'NAM Air', iata: 'IN' },
  PAS: { name: 'Pelita Air', iata: 'IP' },
  TGN: { name: 'Trigana Air', iata: 'IL' },
  TNU: { name: 'TransNusa', iata: '8B' },
  XAX: { name: 'AirAsia X', iata: 'D7' },
  SIA: { name: 'Singapore Airlines', iata: 'SQ' },
  TGW: { name: 'Scoot', iata: 'TR' },
  MAS: { name: 'Malaysia Airlines', iata: 'MH' },
  AXM: { name: 'AirAsia', iata: 'AK' },
  QFA: { name: 'Qantas', iata: 'QF' },
  JST: { name: 'Jetstar', iata: 'JQ' },
  CPA: { name: 'Cathay Pacific', iata: 'CX' },
  UAE: { name: 'Emirates', iata: 'EK' },
  QTR: { name: 'Qatar Airways', iata: 'QR' },
  SVA: { name: 'Saudia', iata: 'SV' },
  THA: { name: 'Thai Airways', iata: 'TG' },
  VJC: { name: 'VietJet Air', iata: 'VJ' },
  KAL: { name: 'Korean Air', iata: 'KE' },
  JAL: { name: 'Japan Airlines', iata: 'JL' },
  ANA: { name: 'All Nippon Airways', iata: 'NH' },
  CES: { name: 'China Eastern', iata: 'MU' },
  CSN: { name: 'China Southern', iata: 'CZ' },
  ETD: { name: 'Etihad', iata: 'EY' },
  THY: { name: 'Turkish Airlines', iata: 'TK' },
  KLM: { name: 'KLM', iata: 'KL' },
}

export function airlineName(callsign: string): string | undefined {
  return AIRLINES[callsign.slice(0, 3)]?.name
}

export function flightNumber(callsign?: string): string | undefined {
  if (!callsign) return undefined
  const airline = AIRLINES[callsign.slice(0, 3)]
  const digits = callsign.slice(3)
  if (!airline || !/^\d+[A-Z]?$/.test(digits)) return undefined
  return `${airline.iata} ${digits}`
}
