import {
  confirmarRequestSchema,
  loginRequestSchema,
  registroRequestSchema,
} from '@agroflete/shared';
import { confirmarUsuario } from '../../../core/application/identidad/confirmar-usuario.js';
import { iniciarSesion } from '../../../core/application/identidad/iniciar-sesion.js';
import { obtenerPerfil } from '../../../core/application/identidad/obtener-perfil.js';
import { registrarUsuario } from '../../../core/application/identidad/registrar-usuario.js';
import { UnauthenticatedError } from '../../../core/domain/errors.js';
import type { RouteDef } from '../types.js';
import { created, noContent, ok } from '../types.js';

export const authRoutes: RouteDef[] = [
  {
    method: 'POST',
    path: '/auth/registro',
    auth: false,
    handler: async (req, ctx) => {
      const input = registroRequestSchema.parse(req.body);
      return created(await registrarUsuario(ctx, input));
    },
  },
  {
    method: 'POST',
    path: '/auth/confirmar',
    auth: false,
    handler: async (req, ctx) => {
      const input = confirmarRequestSchema.parse(req.body);
      await confirmarUsuario(ctx, input);
      return noContent();
    },
  },
  {
    method: 'POST',
    path: '/auth/login',
    auth: false,
    handler: async (req, ctx) => {
      const input = loginRequestSchema.parse(req.body);
      return ok(await iniciarSesion(ctx, input));
    },
  },
  {
    method: 'GET',
    path: '/perfil',
    handler: async (req, ctx) => {
      if (!req.user) throw new UnauthenticatedError();
      return ok(await obtenerPerfil(ctx, req.user.sub));
    },
  },
];
