/** Simula un viaje enviando posiciones interpoladas a la API. */
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { haversineKm, type Flete, type LatLon } from '@agroflete/shared';
import { TABLE_NAME, docClient } from './dynamo.js';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const PASSWORD = process.env.SEED_PASSWORD ?? 'Agroflete2026';

interface Opciones {
  fleteId: string;
  avanzar: boolean;
  pasos: number;
  intervaloMs: number;
}

function parseArgs(argv: string[]): Opciones {
  const [fleteId, ...resto] = argv;
  if (!fleteId) {
    console.error('Uso: pnpm simular-ruta <fleteId> [--avanzar] [--pasos=40] [--intervalo=1500]');
    process.exit(1);
  }
  const flag = (nombre: string) => resto.find((a) => a === `--${nombre}`) !== undefined;
  const valor = (nombre: string) => {
    const hit = resto.find((a) => a.startsWith(`--${nombre}=`));
    return hit ? Number(hit.split('=')[1]) : undefined;
  };
  return {
    fleteId,
    avanzar: flag('avanzar'),
    pasos: valor('pasos') ?? 40,
    intervaloMs: valor('intervalo') ?? 1500,
  };
}

async function leerItem<T>(pk: string, sk: string): Promise<T | null> {
  const res = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { PK: pk, SK: sk } }),
  );
  return (res.Item as T) ?? null;
}

async function api(
  metodo: string,
  ruta: string,
  token: string,
  body?: unknown,
): Promise<Record<string, unknown>> {
  const res = await fetch(API_URL + ruta, {
    method: metodo,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`${metodo} ${ruta} → ${res.status} ${JSON.stringify(json)}`);
  }
  return json;
}

function interpolar(ruta: LatLon[], pasos: number): LatLon[] {
  if (ruta.length < 2) return ruta;
  const acum = [0];
  for (let i = 1; i < ruta.length; i += 1) {
    acum.push(acum[i - 1]! + haversineKm(ruta[i - 1]!, ruta[i]!));
  }
  const total = acum[acum.length - 1]!;
  const salida: LatLon[] = [];
  for (let k = 0; k <= pasos; k += 1) {
    const objetivo = (total * k) / pasos;
    let i = 1;
    while (i < acum.length && acum[i]! < objetivo) i += 1;
    const a = ruta[i - 1]!;
    const b = ruta[i] ?? a;
    const seg = (acum[i] ?? acum[i - 1]!) - acum[i - 1]!;
    const t = seg > 0 ? (objetivo - acum[i - 1]!) / seg : 0;
    salida.push({ lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t });
  }
  return salida;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const CAMINO: Record<string, string> = {
  ASIGNADO: 'EN_CAMINO_ORIGEN',
  EN_CAMINO_ORIGEN: 'CARGANDO',
  CARGANDO: 'EN_RUTA',
};

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));

  const flete = await leerItem<Flete>(`FLETE#${opts.fleteId}`, 'META');
  if (!flete) {
    console.error(`No existe el flete FLETE#${opts.fleteId} en ${TABLE_NAME}.`);
    process.exit(1);
  }
  const transportista = await leerItem<{ email: string }>(
    `USUARIO#${flete.transportistaId}`,
    'PERFIL',
  );
  if (!transportista) {
    console.error(`No se encontró el transportista ${flete.transportistaId}.`);
    process.exit(1);
  }

  const login = (await (
    await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: transportista.email, password: PASSWORD }),
    })
  ).json()) as { data?: { token?: string } };
  const token = login.data?.token;
  if (!token) {
    console.error(
      `No se pudo iniciar sesión como ${transportista.email}. ¿Contraseña? ¿API arriba?`,
    );
    process.exit(1);
  }
  console.log(`Sesión iniciada como ${transportista.email}.`);

  let estado: string = flete.estado;
  if (opts.avanzar) {
    while (CAMINO[estado]) {
      const siguiente = CAMINO[estado]!;
      await api('PATCH', `/fletes/${opts.fleteId}/estado`, token, { nuevoEstado: siguiente });
      estado = siguiente;
      console.log(`  estado → ${estado}`);
      await sleep(400);
    }
  }
  if (estado !== 'EN_RUTA') {
    console.warn(`Aviso: el flete está en ${estado}. La geocerca solo confirma desde EN_RUTA.`);
  }

  const base: LatLon[] =
    flete.rutaVial && flete.rutaVial.length >= 2
      ? flete.rutaVial
      : flete.origen && flete.destino
        ? [flete.origen, flete.destino]
        : [];
  if (base.length < 2) {
    console.error('El flete no tiene ni rutaVial ni origen/destino: nada que simular.');
    process.exit(1);
  }

  const puntos = interpolar(base, opts.pasos);
  console.log(`Enviando ${puntos.length} posiciones cada ${opts.intervaloMs} ms…`);

  for (let i = 0; i < puntos.length; i += 1) {
    const p = puntos[i]!;
    const siguiente = puntos[i + 1] ?? p;
    const velocidad = Math.round(haversineKm(p, siguiente) / (opts.intervaloMs / 3_600_000));
    const resp = (await api('POST', `/fletes/${opts.fleteId}/ubicacion`, token, {
      lat: p.lat,
      lon: p.lon,
      velocidad: Math.min(120, velocidad),
    })) as { data?: { entregaDetectada?: boolean } };
    const pct = Math.round((i / (puntos.length - 1)) * 100);
    process.stdout.write(`\r  ${pct}%  (${p.lat.toFixed(5)}, ${p.lon.toFixed(5)})   `);
    if (resp.data?.entregaDetectada) {
      console.log('\n✅ Geocerca del acopio alcanzada: entrega confirmada automáticamente.');
      return;
    }
    if (i < puntos.length - 1) await sleep(opts.intervaloMs);
  }
  console.log('\nSimulación terminada (sin geocerca; el flete no estaba EN_RUTA).');
}

main().catch((err) => {
  console.error('\n', err instanceof Error ? err.message : err);
  process.exit(1);
});
