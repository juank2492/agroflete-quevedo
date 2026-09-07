import { ConflictError, NotFoundError, ValidationError } from '../../domain/errors.js';
import {
  contextoDePrueba,
  crearTablaTest,
  borrarTablaTest,
  dynamoDisponible,
  type CtxDePrueba,
} from '../../../test/dynamo-it.js';
import {
  cambiarActividadTransportista,
  crearTransportista,
  listarTransportistas,
} from '../identidad/gestion-transportistas.js';
import { iniciarSesion } from '../identidad/iniciar-sesion.js';
import { editarVehiculo, listarFlota, registrarVehiculoAdmin } from './gestion-vehiculos.js';

const TABLA = 'AgrofleteTable-it-flota';

async function altaTransportista(h: CtxDePrueba, email: string) {
  return crearTransportista(h.ctx, {
    nombreCompleto: `T ${email}`,
    email,
    telefono: '0987000010',
  });
}

describe('gestión de flota por el admin (integración)', () => {
  let disponible = false;
  let h: CtxDePrueba;

  beforeAll(async () => {
    disponible = await dynamoDisponible();
    if (!disponible) return;
    await crearTablaTest(TABLA);
    h = contextoDePrueba(TABLA);
  }, 30_000);

  afterAll(async () => {
    if (disponible) await borrarTablaTest(TABLA);
  });

  it('el admin da de alta un transportista CONFIRMADO con contraseña temporal usable', async () => {
    if (!disponible) return;
    const { perfil, passwordTemporal } = await altaTransportista(h, 'carlos@flota.ec');
    expect(perfil.rol).toBe('transportista');
    expect(perfil.estado).toBe('CONFIRMADO');
    expect(passwordTemporal.length).toBeGreaterThanOrEqual(8);

    const login = await iniciarSesion(h.ctx, {
      email: 'carlos@flota.ec',
      password: passwordTemporal,
    });
    expect(login.token).toBeTruthy();

    const pend = await h.ctx.repos.outbox.pendientes(50);
    expect(pend.some((e) => e.tipo === 'TransportistaCreado')).toBe(true);

    expect((await listarTransportistas(h.ctx)).map((t) => t.email)).toContain('carlos@flota.ec');
    await expect(altaTransportista(h, 'carlos@flota.ec')).rejects.toBeInstanceOf(ConflictError);
  });

  it('registra un vehículo a nombre de un transportista y lo edita', async () => {
    if (!disponible) return;
    const { perfil } = await altaTransportista(h, 'diana@flota.ec');

    const v = await registrarVehiculoAdmin(h.ctx, {
      transportistaId: perfil.id,
      placa: 'ABC-1234',
      tipo: 'camion',
      capacidadTon: 12,
      zona: 'buena-fe',
    });
    expect(v.estado).toBe('DISPONIBLE');
    expect((await listarFlota(h.ctx)).find((x) => x.id === v.id)?.transportistaId).toBe(perfil.id);

    const editado = await editarVehiculo(h.ctx, v.id, { zona: 'mocache', estado: 'INACTIVO' });
    expect(editado.zona).toBe('mocache');
    expect(editado.estado).toBe('INACTIVO');
  });

  it('dar de baja un transportista lo bloquea y deja sus vehículos INACTIVO', async () => {
    if (!disponible) return;
    const { perfil } = await altaTransportista(h, 'baja@flota.ec');
    const v = await registrarVehiculoAdmin(h.ctx, {
      transportistaId: perfil.id,
      placa: 'XYZ-7788',
      tipo: 'furgon',
      capacidadTon: 6,
      zona: 'valencia',
    });

    await cambiarActividadTransportista(h.ctx, perfil.id, false);
    expect((await h.ctx.repos.vehiculos.porId(v.id))?.estado).toBe('INACTIVO');
    await expect(
      iniciarSesion(h.ctx, { email: 'baja@flota.ec', password: 'lo-que-sea' }),
    ).rejects.toThrow(/dada de baja/);

    await cambiarActividadTransportista(h.ctx, perfil.id, true);
    expect((await h.ctx.repos.usuarios.porId(perfil.id))?.estado).toBe('CONFIRMADO');
  });

  it('rechaza vehículo para transportista inexistente y editar uno que no existe', async () => {
    if (!disponible) return;
    await expect(
      registrarVehiculoAdmin(h.ctx, {
        transportistaId: 'no-existe',
        placa: 'ZZZ-9999',
        tipo: 'furgon',
        capacidadTon: 5,
        zona: 'valencia',
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(editarVehiculo(h.ctx, 'no-existe', { estado: 'INACTIVO' })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
