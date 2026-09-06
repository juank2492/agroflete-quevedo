/**
 * Siembra de datos de demo (idempotente: ids estables, sobrescribe).
 * Contraseña de todos los usuarios: Agroflete2026
 *
 *  - Reglas de tarifa por defecto
 *  - 4 centros de acopio reales de la zona de Quevedo
 *  - Usuarios: admin + 2 productores + 2 transportistas (confirmados)
 *  - 4 vehículos repartidos por zona
 *  - ~9 solicitudes en distintos estados + 4 fletes con línea de tiempo
 *    (para que /a/metricas y el guion de demo tengan datos coherentes)
 */
import bcrypt from 'bcryptjs';
import { BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import {
  REGLAS_TARIFA_DEFAULT,
  haversineKm,
  type Cultivo,
  type EstadoFlete,
} from '@agroflete/shared';
import { TABLE_NAME, docClient } from './dynamo.js';

const PASSWORD = 'Agroflete2026';
const R = REGLAS_TARIFA_DEFAULT;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const hAtras = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

const ACOPIOS = [
  {
    id: 'acopio-centro',
    nombre: 'Centro de Acopio Quevedo Centro',
    lat: -1.0289,
    lon: -79.4646,
    zona: 'quevedo-centro',
  },
  {
    id: 'acopio-san-camilo',
    nombre: 'Centro de Acopio San Camilo',
    lat: -0.98,
    lon: -79.47,
    zona: 'quevedo-norte',
  },
  {
    id: 'acopio-mocache',
    nombre: 'Centro de Acopio Mocache',
    lat: -1.1667,
    lon: -79.5333,
    zona: 'mocache',
  },
  {
    id: 'acopio-buena-fe',
    nombre: 'Centro de Acopio Buena Fe',
    lat: -0.8931,
    lon: -79.4869,
    zona: 'buena-fe',
  },
] as const;

const acopioPorId = Object.fromEntries(ACOPIOS.map((a) => [a.id, a]));

const USUARIOS = [
  {
    id: 'seed-admin',
    email: 'admin@agroflete.ec',
    nombreCompleto: 'Administración AgroFlete',
    telefono: '0999999999',
    rol: 'admin',
  },
  {
    id: 'seed-productor',
    email: 'productor@demo.ec',
    nombreCompleto: 'Pedro Productor',
    telefono: '0987000001',
    rol: 'productor',
  },
  {
    id: 'seed-productor-2',
    email: 'productor2@demo.ec',
    nombreCompleto: 'María Loor',
    telefono: '0987000003',
    rol: 'productor',
  },
  {
    id: 'seed-transportista',
    email: 'transportista@demo.ec',
    nombreCompleto: 'Tomás Transportista',
    telefono: '0987000002',
    rol: 'transportista',
  },
  {
    id: 'seed-transportista-2',
    email: 'transportista2@demo.ec',
    nombreCompleto: 'Luis Andrade',
    telefono: '0987000004',
    rol: 'transportista',
  },
] as const;

const VEHICULOS = [
  {
    id: 'veh-1',
    transportistaId: 'seed-transportista',
    placa: 'PQV-1201',
    tipo: 'camion',
    capacidadTon: 12,
    zona: 'quevedo-centro',
    estado: 'DISPONIBLE',
  },
  {
    id: 'veh-2',
    transportistaId: 'seed-transportista',
    placa: 'PQV-2202',
    tipo: 'camion-tolva',
    capacidadTon: 25,
    zona: 'mocache',
    estado: 'DISPONIBLE',
  },
  {
    id: 'veh-3',
    transportistaId: 'seed-transportista-2',
    placa: 'LBF-3303',
    tipo: 'plataforma',
    capacidadTon: 18,
    zona: 'buena-fe',
    estado: 'OCUPADO',
  },
  {
    id: 'veh-4',
    transportistaId: 'seed-transportista-2',
    placa: 'LNQ-4404',
    tipo: 'furgon',
    capacidadTon: 8,
    zona: 'quevedo-norte',
    estado: 'DISPONIBLE',
  },
] as const;

interface SeedSolicitud {
  id: string;
  productorId: string;
  origen: { lat: number; lon: number };
  acopioId: keyof typeof acopioPorId;
  cultivo: Cultivo;
  pesoTon: number;
  estado: 'PENDIENTE' | 'ASIGNADA' | 'EN_PROCESO' | 'COMPLETADA' | 'CANCELADA';
  horasAtras: number;
  fleteId?: string;
  retrasoNotificado?: boolean;
}

const SOLICITUDES: SeedSolicitud[] = [
  {
    id: 'sol-1',
    productorId: 'seed-productor',
    origen: { lat: -1.16, lon: -79.4 },
    acopioId: 'acopio-centro',
    cultivo: 'maiz',
    pesoTon: 9,
    estado: 'PENDIENTE',
    horasAtras: 2,
  },
  {
    id: 'sol-2',
    productorId: 'seed-productor-2',
    origen: { lat: -0.78, lon: -79.55 },
    acopioId: 'acopio-buena-fe',
    cultivo: 'banano',
    pesoTon: 6,
    estado: 'PENDIENTE',
    horasAtras: 4,
  },
  {
    id: 'sol-3',
    productorId: 'seed-productor',
    origen: { lat: -1.3, lon: -79.45 },
    acopioId: 'acopio-mocache',
    cultivo: 'maiz',
    pesoTon: 14,
    estado: 'PENDIENTE',
    horasAtras: 10,
    retrasoNotificado: true,
  },
  {
    id: 'sol-4',
    productorId: 'seed-productor',
    origen: { lat: -0.92, lon: -79.52 },
    acopioId: 'acopio-centro',
    cultivo: 'maiz',
    pesoTon: 8,
    estado: 'ASIGNADA',
    horasAtras: 6,
    fleteId: 'flete-1',
  },
  {
    id: 'sol-5',
    productorId: 'seed-productor-2',
    origen: { lat: -0.8, lon: -79.42 },
    acopioId: 'acopio-buena-fe',
    cultivo: 'banano',
    pesoTon: 10,
    estado: 'EN_PROCESO',
    horasAtras: 8,
    fleteId: 'flete-2',
  },
  {
    id: 'sol-6',
    productorId: 'seed-productor',
    origen: { lat: -1.32, lon: -79.6 },
    acopioId: 'acopio-mocache',
    cultivo: 'maiz',
    pesoTon: 20,
    estado: 'COMPLETADA',
    horasAtras: 30,
    fleteId: 'flete-3',
  },
  {
    id: 'sol-7',
    productorId: 'seed-productor-2',
    origen: { lat: -1.16, lon: -79.55 },
    acopioId: 'acopio-centro',
    cultivo: 'banano',
    pesoTon: 5,
    estado: 'COMPLETADA',
    horasAtras: 48,
    fleteId: 'flete-4',
  },
  {
    id: 'sol-8',
    productorId: 'seed-productor',
    origen: { lat: -1.1, lon: -79.38 },
    acopioId: 'acopio-san-camilo',
    cultivo: 'maiz',
    pesoTon: 7,
    estado: 'CANCELADA',
    horasAtras: 20,
  },
  {
    id: 'sol-9',
    productorId: 'seed-productor',
    origen: { lat: -0.9, lon: -79.4 },
    acopioId: 'acopio-centro',
    cultivo: 'maiz',
    pesoTon: 11,
    estado: 'PENDIENTE',
    horasAtras: 1,
  },
];

interface SeedFlete {
  id: string;
  solicitudId: string;
  vehiculoId: string;
  transportistaId: string;
  estado: EstadoFlete;
  pasos: EstadoFlete[];
}

const FLETES: SeedFlete[] = [
  {
    id: 'flete-1',
    solicitudId: 'sol-4',
    vehiculoId: 'veh-1',
    transportistaId: 'seed-transportista',
    estado: 'ASIGNADO',
    pasos: ['ASIGNADO'],
  },
  {
    id: 'flete-2',
    solicitudId: 'sol-5',
    vehiculoId: 'veh-3',
    transportistaId: 'seed-transportista-2',
    estado: 'EN_RUTA',
    pasos: ['ASIGNADO', 'EN_CAMINO_ORIGEN', 'CARGANDO', 'EN_RUTA'],
  },
  {
    id: 'flete-3',
    solicitudId: 'sol-6',
    vehiculoId: 'veh-2',
    transportistaId: 'seed-transportista',
    estado: 'ENTREGADO',
    pasos: ['ASIGNADO', 'EN_CAMINO_ORIGEN', 'CARGANDO', 'EN_RUTA', 'ENTREGADO'],
  },
  {
    id: 'flete-4',
    solicitudId: 'sol-7',
    vehiculoId: 'veh-4',
    transportistaId: 'seed-transportista-2',
    estado: 'ENTREGADO',
    pasos: ['ASIGNADO', 'EN_CAMINO_ORIGEN', 'CARGANDO', 'EN_RUTA', 'ENTREGADO'],
  },
];

function tarifaDe(s: SeedSolicitud): { distanciaKm: number; tarifa: number } {
  const acopio = acopioPorId[s.acopioId]!;
  const distanciaKm = round2(
    haversineKm(s.origen, { lat: acopio.lat, lon: acopio.lon }) * R.factorSinuosidad,
  );
  const factor = s.cultivo === 'banano' ? R.factorBanano : R.factorMaiz;
  return { distanciaKm, tarifa: round2(R.tarifaBaseKm * distanciaKm * factor) };
}

async function main(): Promise<void> {
  const hash = bcrypt.hashSync(PASSWORD, 12);
  const solById = Object.fromEntries(SOLICITUDES.map((s) => [s.id, s]));

  const items: Record<string, unknown>[] = [
    { PK: 'TARIFA#REGLAS', SK: 'VIGENTE', ...R },

    ...ACOPIOS.map((a) => ({ PK: 'CATALOGO#ACOPIOS', SK: `ACOPIO#${a.id}`, ...a })),

    ...USUARIOS.map((u) => ({
      PK: `USUARIO#${u.id}`,
      SK: 'PERFIL',
      gsi1pk: `EMAIL#${u.email}`,
      gsi1sk: 'USUARIO',
      ...u,
      passwordHash: hash,
      estado: 'CONFIRMADO',
      createdAt: hAtras(72),
    })),

    ...VEHICULOS.map((v) => ({
      PK: `VEHICULO#${v.id}`,
      SK: 'META',
      gsi5pk: `TRANSP_VEH#${v.transportistaId}`,
      gsi5sk: `VEHICULO#${v.id}`,
      ...(v.estado === 'DISPONIBLE'
        ? { gsi2pk: `DISP#${v.zona}`, gsi2sk: `VEHICULO#${v.id}` }
        : {}),
      ...v,
    })),

    ...SOLICITUDES.map((s) => {
      const { distanciaKm, tarifa } = tarifaDe(s);
      const createdAt = hAtras(s.horasAtras);
      const acopio = acopioPorId[s.acopioId]!;
      return {
        PK: `SOLICITUD#${s.id}`,
        SK: 'META',
        gsi3pk: `PRODUCTOR#${s.productorId}`,
        gsi3sk: createdAt,
        gsi4pk: `ESTADO_SOL#${s.estado}`,
        gsi4sk: createdAt,
        id: s.id,
        productorId: s.productorId,
        origen: s.origen,
        acopioId: s.acopioId,
        acopioNombre: acopio.nombre,
        cultivo: s.cultivo,
        pesoTon: s.pesoTon,
        zona: acopio.zona,
        distanciaKm,
        tarifaEstimada: tarifa,
        estado: s.estado,
        createdAt,
        ...(s.fleteId ? { fleteId: s.fleteId } : {}),
        ...(s.retrasoNotificado ? { retrasoNotificado: true } : {}),
      };
    }),

    ...FLETES.map((f) => {
      const s = solById[f.solicitudId]!;
      const createdAt = hAtras(s.horasAtras - 0.5);
      const { tarifa } = tarifaDe(s);
      const timeline = f.pasos.map((estado, i) => ({
        estado,
        ts: hAtras(s.horasAtras - 0.5 - i * 0.4),
        actorId: i === 0 ? 'seed-admin' : f.transportistaId,
      }));
      return {
        PK: `FLETE#${f.id}`,
        SK: 'META',
        gsi3pk: `PRODUCTOR_FLETE#${s.productorId}`,
        gsi3sk: createdAt,
        gsi4pk: `ESTADO_FLETE#${f.estado}`,
        gsi4sk: createdAt,
        gsi5pk: `TRANSP_FLETE#${f.transportistaId}`,
        gsi5sk: createdAt,
        id: f.id,
        solicitudId: f.solicitudId,
        vehiculoId: f.vehiculoId,
        transportistaId: f.transportistaId,
        productorId: s.productorId,
        tarifa,
        estado: f.estado,
        timeline,
        createdAt,
      };
    }),
  ];

  for (let i = 0; i < items.length; i += 25) {
    await docClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [TABLE_NAME]: items.slice(i, i + 25).map((Item) => ({ PutRequest: { Item } })),
        },
      }),
    );
  }

  console.log(`Sembrado en ${TABLE_NAME}:`);
  console.log(`  reglas de tarifa + ${ACOPIOS.length} acopios`);
  console.log(`  ${USUARIOS.length} usuarios (contraseña: ${PASSWORD})`);
  for (const u of USUARIOS) console.log(`    - ${u.email} (${u.rol})`);
  console.log(
    `  ${VEHICULOS.length} vehículos · ${SOLICITUDES.length} solicitudes · ${FLETES.length} fletes`,
  );
}

main().catch((err) => {
  console.error('Fallo en seed:', err);
  process.exit(1);
});
