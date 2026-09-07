import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../domain/errors.js';
import {
  contextoDePrueba,
  crearTablaTest,
  borrarTablaTest,
  dynamoDisponible,
  type CtxDePrueba,
} from '../../../test/dynamo-it.js';
import { procesarOutbox } from '../../../entrypoints/worker/dispatcher.js';
import { actualizarPerfil } from './actualizar-perfil.js';
import { cambiarPassword } from './cambiar-password.js';
import { confirmarUsuario } from './confirmar-usuario.js';
import { iniciarSesion } from './iniciar-sesion.js';
import { obtenerPerfil } from './obtener-perfil.js';
import { registrarUsuario } from './registrar-usuario.js';

const TABLA = 'AgrofleteTable-it-identidad';

const base = {
  password: 'Cosecha2026',
  nombreCompleto: 'Ana Pérez',
  telefono: '0987654321',
  rol: 'productor' as const,
};

describe('identidad (integración con DynamoDB Local)', () => {
  let disponible = false;
  let harness: CtxDePrueba;

  beforeAll(async () => {
    disponible = await dynamoDisponible();
    if (!disponible) {
      console.warn('\n[skip] DynamoDB Local no está disponible; corre `pnpm infra:up`.\n');
      return;
    }
    await crearTablaTest(TABLA);
    harness = contextoDePrueba(TABLA);
  }, 30_000);

  afterAll(async () => {
    if (disponible) await borrarTablaTest(TABLA);
  });

  function correoDe(email: string) {
    return { ...base, email };
  }

  it('registra un usuario en PENDIENTE_CONF y encola UsuarioRegistrado', async () => {
    if (!disponible) return;
    const { userId } = await registrarUsuario(harness.ctx, correoDe('ana1@finca.ec'));
    expect(userId).toBeTruthy();

    const u = await harness.ctx.repos.usuarios.porEmail('ana1@finca.ec');
    expect(u?.estado).toBe('PENDIENTE_CONF');
    expect(u?.passwordHash).not.toBe(base.password);
    expect(u?.codigoConf).toMatch(/^\d{6}$/);

    const pend = await harness.ctx.repos.outbox.pendientes(10);
    expect(pend.some((e) => e.tipo === 'UsuarioRegistrado')).toBe(true);
  });

  it('el worker despacha el evento y "envía" el correo con el código', async () => {
    if (!disponible) return;
    await registrarUsuario(harness.ctx, correoDe('ana2@finca.ec'));
    harness.correos.length = 0;
    await procesarOutbox(harness.ctx);

    const correo = harness.correos.find((c) => c.to === 'ana2@finca.ec');
    expect(correo).toBeDefined();
    expect(correo?.text).toMatch(/\d{6}/);
  });

  it('rechaza correo duplicado', async () => {
    if (!disponible) return;
    await registrarUsuario(harness.ctx, correoDe('dup@finca.ec'));
    await expect(registrarUsuario(harness.ctx, correoDe('dup@finca.ec'))).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it('confirma con el código correcto y falla con uno incorrecto', async () => {
    if (!disponible) return;
    await registrarUsuario(harness.ctx, correoDe('ana3@finca.ec'));
    const u = await harness.ctx.repos.usuarios.porEmail('ana3@finca.ec');

    await expect(
      confirmarUsuario(harness.ctx, { email: 'ana3@finca.ec', codigo: '000000' }),
    ).rejects.toBeInstanceOf(ValidationError);

    await confirmarUsuario(harness.ctx, { email: 'ana3@finca.ec', codigo: u!.codigoConf! });
    const confirmado = await harness.ctx.repos.usuarios.porEmail('ana3@finca.ec');
    expect(confirmado?.estado).toBe('CONFIRMADO');
    expect(confirmado?.codigoConf).toBeUndefined();
  });

  it('login: falla sin confirmar, funciona tras confirmar y el token es válido', async () => {
    if (!disponible) return;
    await registrarUsuario(harness.ctx, correoDe('ana4@finca.ec'));

    await expect(
      iniciarSesion(harness.ctx, { email: 'ana4@finca.ec', password: base.password }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const u = await harness.ctx.repos.usuarios.porEmail('ana4@finca.ec');
    await confirmarUsuario(harness.ctx, { email: 'ana4@finca.ec', codigo: u!.codigoConf! });

    const { token, perfil } = await iniciarSesion(harness.ctx, {
      email: 'ana4@finca.ec',
      password: base.password,
    });
    expect(perfil.rol).toBe('productor');
    const claims = harness.ctx.tokens.verify(token);
    expect(claims.sub).toBe(perfil.id);

    const p = await obtenerPerfil(harness.ctx, claims.sub);
    expect(p.email).toBe('ana4@finca.ec');
  });

  it('login con contraseña equivocada da ForbiddenError genérico', async () => {
    if (!disponible) return;
    await registrarUsuario(harness.ctx, correoDe('ana5@finca.ec'));
    const u = await harness.ctx.repos.usuarios.porEmail('ana5@finca.ec');
    await confirmarUsuario(harness.ctx, { email: 'ana5@finca.ec', codigo: u!.codigoConf! });

    await expect(
      iniciarSesion(harness.ctx, { email: 'ana5@finca.ec', password: 'incorrecta' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('obtenerPerfil de un id inexistente lanza NotFoundError', async () => {
    if (!disponible) return;
    await expect(obtenerPerfil(harness.ctx, 'no-existe')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('actualizarPerfil cambia nombre y teléfono (email y rol intactos)', async () => {
    if (!disponible) return;
    await registrarUsuario(harness.ctx, correoDe('ana6@finca.ec'));
    const u = await harness.ctx.repos.usuarios.porEmail('ana6@finca.ec');
    await confirmarUsuario(harness.ctx, { email: 'ana6@finca.ec', codigo: u!.codigoConf! });

    const p = await actualizarPerfil(harness.ctx, u!.id, {
      nombreCompleto: 'Ana María Pérez',
      telefono: '0991112233',
    });
    expect(p.nombreCompleto).toBe('Ana María Pérez');
    expect(p.telefono).toBe('0991112233');
    expect(p.email).toBe('ana6@finca.ec');
    expect(p.rol).toBe('productor');

    const guardado = await harness.ctx.repos.usuarios.porId(u!.id);
    expect(guardado?.nombreCompleto).toBe('Ana María Pérez');
  });

  it('cambiarPassword exige la actual y luego permite iniciar sesión con la nueva', async () => {
    if (!disponible) return;
    await registrarUsuario(harness.ctx, correoDe('ana7@finca.ec'));
    const u = await harness.ctx.repos.usuarios.porEmail('ana7@finca.ec');
    await confirmarUsuario(harness.ctx, { email: 'ana7@finca.ec', codigo: u!.codigoConf! });

    await expect(
      cambiarPassword(harness.ctx, u!.id, {
        passwordActual: 'noEsLaActual1',
        passwordNueva: 'NuevaClave2027',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await cambiarPassword(harness.ctx, u!.id, {
      passwordActual: base.password,
      passwordNueva: 'NuevaClave2027',
    });

    await expect(
      iniciarSesion(harness.ctx, { email: 'ana7@finca.ec', password: base.password }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    const { perfil } = await iniciarSesion(harness.ctx, {
      email: 'ana7@finca.ec',
      password: 'NuevaClave2027',
    });
    expect(perfil.email).toBe('ana7@finca.ec');
  });
});
