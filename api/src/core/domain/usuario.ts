import type { PerfilPublico } from '@agroflete/shared';
import type { UsuarioRecord } from '../ports/repositories.js';

export function toPerfilPublico(u: UsuarioRecord): PerfilPublico {
  return {
    id: u.id,
    email: u.email,
    nombreCompleto: u.nombreCompleto,
    telefono: u.telefono,
    rol: u.rol,
    estado: u.estado,
  };
}

export function codigoVigente(u: UsuarioRecord, ahoraMs: number): boolean {
  return typeof u.codigoExpiraTs === 'number' && u.codigoExpiraTs >= ahoraMs;
}
