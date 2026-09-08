/** Siembra datos de demo de forma idempotente. */
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
  {
    id: 'veh-5',
    transportistaId: 'seed-transportista-2',
    placa: 'LBF-5505',
    tipo: 'plataforma',
    capacidadTon: 22,
    zona: 'buena-fe',
    estado: 'DISPONIBLE',
  },
  {
    id: 'veh-6',
    transportistaId: 'seed-transportista',
    placa: 'PQV-6606',
    tipo: 'camion',
    capacidadTon: 15,
    zona: 'mocache',
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
  auto?: boolean;
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
    auto: true,
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

const cultivoDe = (clave: string) => R.cultivos.find((c) => c.clave === clave);

const c5 = (n: number) => Math.round(n * 1e5) / 1e5;
const RUTA_FLETE_2 = (() => {
  const from = { lat: -0.8, lon: -79.42 };
  const to = { lat: -0.8931, lon: -79.4869 };
  const n = 6;
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    return {
      lat: c5(from.lat + (to.lat - from.lat) * t * 0.62 + (Math.random() - 0.5) * 0.003),
      lon: c5(from.lon + (to.lon - from.lon) * t * 0.62 + (Math.random() - 0.5) * 0.003),
      ts: hAtras(2 - i * 0.25),
      velocidad: 40 + Math.round(Math.random() * 20),
    };
  });
})();

const STOCKS = [
  {
    acopioId: 'acopio-centro',
    cultivo: 'maiz',
    cantidadActual: 240,
    umbralMinimo: 30,
    umbralMaximo: 200,
  },
  {
    acopioId: 'acopio-centro',
    cultivo: 'banano',
    cantidadActual: 80,
    umbralMinimo: 20,
    umbralMaximo: 150,
  },
  {
    acopioId: 'acopio-san-camilo',
    cultivo: 'maiz',
    cantidadActual: 12,
    umbralMinimo: 40,
    umbralMaximo: 180,
  },
  {
    acopioId: 'acopio-mocache',
    cultivo: 'maiz',
    cantidadActual: 95,
    umbralMinimo: 0,
    umbralMaximo: 0,
  },
  {
    acopioId: 'acopio-buena-fe',
    cultivo: 'banano',
    cantidadActual: 60,
    umbralMinimo: 15,
    umbralMaximo: 120,
  },
];

/** Avisos in-app de demo para que la campanita no esté vacía. */
const NOTIFICACIONES: {
  userId: string;
  categoria: 'solicitud' | 'flete' | 'pago' | 'incidencia' | 'sistema';
  titulo: string;
  cuerpo: string;
  enlace?: string;
  horasAtras: number;
  leida?: boolean;
}[] = [
  {
    userId: 'seed-productor',
    categoria: 'flete',
    titulo: 'Transportista asignado',
    cuerpo: 'Ya hay un transportista asignado a tu carga de maíz.',
    enlace: '/p/solicitudes/sol-4',
    horasAtras: 5,
  },
  {
    userId: 'seed-productor',
    categoria: 'pago',
    titulo: 'Pago confirmado',
    cuerpo: 'Recibimos tu pago. Tu carga entró en la cola de asignación.',
    enlace: '/p/solicitudes/sol-4',
    horasAtras: 6,
    leida: true,
  },
  {
    userId: 'seed-transportista',
    categoria: 'flete',
    titulo: 'Nuevo flete asignado',
    cuerpo: 'Revisa los detalles y actualiza el estado del viaje.',
    enlace: '/t/fletes',
    horasAtras: 5,
  },
];

const CATEGORIAS_ORD = [...R.categorias].sort((a, b) => a.capacidadMaxTon - b.capacidadMaxTon);

function categoriaDe(pesoTon: number) {
  return CATEGORIAS_ORD.find((c) => pesoTon <= c.capacidadMaxTon) ?? CATEGORIAS_ORD.at(-1)!;
}

function tarifaDe(s: SeedSolicitud): { distanciaKm: number; tarifa: number; categoria: string } {
  const acopio = acopioPorId[s.acopioId]!;
  const distanciaKm = round2(
    haversineKm(s.origen, { lat: acopio.lat, lon: acopio.lon }) * R.factorSinuosidad,
  );
  const factor = cultivoDe(s.cultivo)?.factor ?? 1;
  const cat = categoriaDe(s.pesoTon);
  const costoKm = R.tarifaBaseKm + cat.costoPorTonKm * s.pesoTon;
  return { distanciaKm, tarifa: round2(costoKm * distanciaKm * factor), categoria: cat.tipo };
}

async function main(): Promise<void> {
  const hash = bcrypt.hashSync(PASSWORD, 12);
  const solById = Object.fromEntries(SOLICITUDES.map((s) => [s.id, s]));

  const items: Record<string, unknown>[] = [
    { PK: 'TARIFA#REGLAS', SK: 'VIGENTE', ...R },
    { PK: 'AJUSTE#OPERACION', SK: 'VIGENTE', autoEmparejar: true },

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
      const { distanciaKm, tarifa, categoria } = tarifaDe(s);
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
        acopioLat: acopio.lat,
        acopioLon: acopio.lon,
        cultivo: s.cultivo,
        cultivoNombre: cultivoDe(s.cultivo)?.nombre ?? s.cultivo,
        pesoTon: s.pesoTon,
        categoriaCarga: categoria,
        zona: acopio.zona,
        distanciaKm,
        tarifaEstimada: tarifa,
        estado: s.estado,
        createdAt,
        // sol-1 queda sin pagar para demostrar el flujo de pago; el resto, pagado.
        pago:
          s.id === 'sol-1'
            ? { estado: 'PENDIENTE', monto: tarifa, actualizadoEn: createdAt }
            : {
                estado: 'PAGADO',
                metodo: 'PASARELA',
                monto: tarifa,
                referencia: `SEED-${s.id}`,
                actualizadoEn: createdAt,
              },
        ...(s.fleteId ? { fleteId: s.fleteId } : {}),
        ...(s.retrasoNotificado ? { retrasoNotificado: true } : {}),
      };
    }),

    ...FLETES.map((f) => {
      const s = solById[f.solicitudId]!;
      const ac = acopioPorId[s.acopioId]!;
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
        origen: s.origen,
        destino: { lat: ac.lat, lon: ac.lon },
        tarifa,
        estado: f.estado,
        timeline,
        createdAt,
        ...(f.auto ? { auto: true } : {}),
        ...(f.id === 'flete-2' ? { ultimaUbicacion: RUTA_FLETE_2[RUTA_FLETE_2.length - 1] } : {}),
      };
    }),

    ...RUTA_FLETE_2.map((p) => ({
      PK: 'FLETE#flete-2',
      SK: `TRACK#${p.ts}`,
      lat: p.lat,
      lon: p.lon,
      ts: p.ts,
      velocidad: p.velocidad,
    })),

    ...STOCKS.map((st) => ({
      PK: `ACOPIO#${st.acopioId}`,
      SK: `STOCK#${st.cultivo}`,
      cultivo: st.cultivo,
      cantidadActual: st.cantidadActual,
      umbralMinimo: st.umbralMinimo,
      umbralMaximo: st.umbralMaximo,
    })),

    ...NOTIFICACIONES.map((n, i) => {
      const ms = Date.now() - n.horasAtras * 3_600_000;
      const id = `${String(ms).padStart(16, '0')}-${i}`;
      return {
        PK: `NOTIF#${n.userId}`,
        SK: `NOTIF#${id}`,
        id,
        userId: n.userId,
        categoria: n.categoria,
        titulo: n.titulo,
        cuerpo: n.cuerpo,
        ...(n.enlace ? { enlace: n.enlace } : {}),
        createdAt: new Date(ms).toISOString(),
        ...(n.leida ? { leidoEn: new Date(ms + 60_000).toISOString() } : {}),
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
    `  ${VEHICULOS.length} vehículos · ${SOLICITUDES.length} solicitudes · ${FLETES.length} fletes · ${STOCKS.length} filas de inventario`,
  );
}

main().catch((err) => {
  console.error('Fallo en seed:', err);
  process.exit(1);
});
