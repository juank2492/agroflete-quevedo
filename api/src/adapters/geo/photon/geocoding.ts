import { haversineKm, type LatLon, type LugarGeocodificado } from '@agroflete/shared';
import type { GeocodingPort } from '../../../core/ports/geo.js';

/** Geocodifica con Photon y usa Nominatim como respaldo, limitado a Quevedo. */

const TIMEOUT_MS = 4000;
const LIMITE = 8;

interface Config {
  centro: LatLon;
  radioKm: number;
}

const TIPOS: Record<string, string> = {
  park: 'parque',
  garden: 'parque',
  recreation_ground: 'área recreativa',
  playground: 'parque infantil',
  pitch: 'cancha',
  sports_centre: 'complejo deportivo',
  stadium: 'estadio',
  school: 'escuela',
  kindergarten: 'guardería',
  college: 'instituto',
  university: 'universidad',
  hospital: 'hospital',
  clinic: 'clínica',
  doctors: 'consultorio',
  pharmacy: 'farmacia',
  bank: 'banco',
  atm: 'cajero',
  marketplace: 'mercado',
  supermarket: 'supermercado',
  convenience: 'tienda',
  fuel: 'gasolinera',
  restaurant: 'restaurante',
  fast_food: 'comida rápida',
  cafe: 'cafetería',
  bar: 'bar',
  hotel: 'hotel',
  guest_house: 'hospedaje',
  church: 'iglesia',
  place_of_worship: 'iglesia',
  townhall: 'municipio',
  police: 'policía',
  fire_station: 'bomberos',
  bus_station: 'terminal',
  parking: 'parqueo',
  bank_office: 'banco',
  hamlet: 'recinto',
  farm: 'finca',
  industrial: 'zona industrial',
  commercial: 'zona comercial',
  residential: 'zona residencial',
  neighbourhood: 'barrio',
  suburb: 'barrio',
  quarter: 'barrio',
};

const GENERICO_POR_KEY: Record<string, string> = {
  highway: 'calle',
  shop: 'comercio',
  amenity: 'servicio',
  leisure: 'lugar recreativo',
  building: 'edificio',
  tourism: 'sitio turístico',
  landuse: 'zona',
  place: 'lugar',
  natural: 'lugar',
  office: 'oficina',
};

function bonito(t: string): string {
  // convierte "recreation_ground" → "recreation ground" solo como último recurso
  return t.includes('_') ? t.replace(/_/g, ' ') : t;
}

function etiquetaTipo(key?: string, value?: string, type?: string): string {
  if (value && TIPOS[value]) return TIPOS[value] as string;
  if (type && TIPOS[type]) return TIPOS[type] as string;
  if (type === 'house') return 'dirección';
  if (type === 'street' || key === 'highway') return 'calle';
  if (['locality', 'district', 'city_block', 'isolated_dwelling'].includes(type ?? ''))
    return 'barrio';
  if (['city', 'town', 'village'].includes(type ?? '')) return 'ciudad';
  if (key && GENERICO_POR_KEY[key]) return GENERICO_POR_KEY[key] as string;
  // nunca devolver un tag OSM crudo tipo "recreation_ground"
  if (value && !value.includes('_') && value.length <= 14) return bonito(value);
  return 'lugar';
}

function segundaLinea(campos: (string | undefined | null)[]): string {
  const vistos = new Set<string>();
  return campos
    .filter((c): c is string => !!c && !vistos.has(c) && (vistos.add(c), true))
    .join(', ');
}

function bbox(
  centro: LatLon,
  radioKm: number,
): { minLon: number; minLat: number; maxLon: number; maxLat: number } {
  const dLat = radioKm / 111;
  const dLon = radioKm / (111 * Math.cos((centro.lat * Math.PI) / 180));
  return {
    minLon: centro.lon - dLon,
    minLat: centro.lat - dLat,
    maxLon: centro.lon + dLon,
    maxLat: centro.lat + dLat,
  };
}

interface Bruto {
  lat: number;
  lon: number;
  nombre: string;
  etiqueta: string;
  tipo: string;
}

async function pedirPhoton(q: string, cfg: Config): Promise<Bruto[]> {
  const b = bbox(cfg.centro, cfg.radioKm);
  const p = new URLSearchParams({ q, limit: '10' });
  p.set('lat', String(cfg.centro.lat));
  p.set('lon', String(cfg.centro.lon));
  p.set('bbox', `${b.minLon},${b.minLat},${b.maxLon},${b.maxLat}`);
  const res = await fetch(`https://photon.komoot.io/api/?${p}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Photon HTTP ${res.status}`);
  const data = (await res.json()) as {
    features?: {
      geometry?: { coordinates?: [number, number] };
      properties?: Record<string, string | undefined>;
    }[];
  };
  return (data.features ?? [])
    .filter((f) => Array.isArray(f.geometry?.coordinates))
    .map((f) => {
      const [lon, lat] = f.geometry!.coordinates as [number, number];
      const pr = f.properties ?? {};
      return {
        lat,
        lon,
        nombre: pr['name'] || pr['street'] || pr['city'] || 'Ubicación',
        etiqueta: segundaLinea([
          pr['name'] ? pr['street'] : null,
          pr['housenumber'],
          pr['district'],
          pr['city'],
          pr['state'],
        ]),
        tipo: etiquetaTipo(pr['osm_key'], pr['osm_value'], pr['type']),
      };
    });
}

async function pedirNominatim(q: string, cfg: Config): Promise<Bruto[]> {
  const b = bbox(cfg.centro, cfg.radioKm);
  const p = new URLSearchParams({
    format: 'jsonv2',
    q,
    limit: '10',
    addressdetails: '1',
    'accept-language': 'es',
    bounded: '1',
    viewbox: `${b.minLon},${b.maxLat},${b.maxLon},${b.minLat}`,
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${p}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'User-Agent': 'agroflete-quevedo/0.1 (proyecto integrador)' },
  });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  const data = (await res.json()) as {
    lat: string;
    lon: string;
    name?: string;
    display_name?: string;
    category?: string;
    type?: string;
    addresstype?: string;
    address?: Record<string, string>;
  }[];
  return (data ?? []).map((d) => {
    const a = d.address ?? {};
    return {
      lat: Number(d.lat),
      lon: Number(d.lon),
      nombre: d.name || (d.display_name ?? '').split(',')[0] || 'Ubicación',
      etiqueta: segundaLinea([
        a['road'],
        a['suburb'],
        a['city'] || a['town'] || a['village'],
        a['state'],
      ]),
      tipo: etiquetaTipo(d.category, d.type, d.addresstype),
    };
  });
}

export function makePhotonGeocoding(cfg: Config): GeocodingPort {
  return {
    async buscar(texto) {
      let brutos: Bruto[];
      try {
        brutos = await pedirPhoton(texto, cfg);
      } catch {
        brutos = await pedirNominatim(texto, cfg);
      }
      return brutos
        .map<LugarGeocodificado>((b) => ({
          lat: b.lat,
          lon: b.lon,
          nombre: b.nombre,
          etiqueta: b.etiqueta,
          tipo: b.tipo,
          distanciaKm: Math.round(haversineKm(cfg.centro, { lat: b.lat, lon: b.lon }) * 10) / 10,
        }))
        .filter((l) => l.distanciaKm <= cfg.radioKm)
        .sort((a, b) => a.distanciaKm - b.distanciaKm)
        .slice(0, LIMITE);
    },
  };
}
