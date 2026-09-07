import type {
  CrearTransportistaRequest,
  CrearTransportistaResponse,
  PerfilPublico,
} from '@agroflete/shared';
import type { AppContext } from '../../app-context.js';
import { ConflictError, NotFoundError, ValidationError } from '../../domain/errors.js';
import { toPerfilPublico } from '../../domain/usuario.js';

/** Contraseña temporal que cumple `passwordSchema`. */
function passwordTemporal(ctx: AppContext): string {
  return `Agro-${ctx.ids.codigoNumerico(6)}`;
}

/** Crea una cuenta de transportista confirmada con contraseña temporal. */
export async function crearTransportista(
  ctx: AppContext,
  input: CrearTransportistaRequest,
): Promise<CrearTransportistaResponse> {
  const existente = await ctx.repos.usuarios.porEmail(input.email);
  if (existente) {
    throw new ConflictError('Ya existe una cuenta con ese correo');
  }

  const id = ctx.ids.uuid();
  const password = passwordTemporal(ctx);
  const passwordHash = await ctx.hasher.hash(password);
  const rec = {
    id,
    email: input.email,
    nombreCompleto: input.nombreCompleto,
    telefono: input.telefono,
    rol: 'transportista' as const,
    passwordHash,
    estado: 'CONFIRMADO' as const,
    createdAt: ctx.clock.nowIso(),
  };
  await ctx.repos.usuarios.crear(rec);

  await ctx.events.publish('TransportistaCreado', {
    userId: id,
    email: input.email,
    nombreCompleto: input.nombreCompleto,
    passwordTemporal: password,
  });

  return { perfil: toPerfilPublico(rec), passwordTemporal: password };
}

export async function listarTransportistas(ctx: AppContext): Promise<PerfilPublico[]> {
  const list = await ctx.repos.usuarios.listarPorRol('transportista');
  return list.map(toPerfilPublico).sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));
}

/** Cambia el estado del transportista y sincroniza sus vehículos. */
export async function cambiarActividadTransportista(
  ctx: AppContext,
  id: string,
  activo: boolean,
): Promise<PerfilPublico> {
  const u = await ctx.repos.usuarios.porId(id);
  if (!u || u.rol !== 'transportista') throw new NotFoundError('Transportista no encontrado');

  const vehiculos = await ctx.repos.vehiculos.porTransportista(id);
  if (!activo && vehiculos.some((v) => v.estado === 'OCUPADO')) {
    throw new ValidationError('Tiene un vehículo en un flete en curso; no se puede dar de baja');
  }

  await ctx.repos.usuarios.actualizar(id, { estado: activo ? 'CONFIRMADO' : 'INACTIVO' });
  if (!activo) {
    for (const v of vehiculos) {
      if (v.estado === 'DISPONIBLE')
        await ctx.repos.vehiculos.actualizar(v.id, { estado: 'INACTIVO' });
    }
  }
  return toPerfilPublico({ ...u, estado: activo ? 'CONFIRMADO' : 'INACTIVO' });
}
