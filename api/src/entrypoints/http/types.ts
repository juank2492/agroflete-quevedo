import type { JwtClaims, Rol } from '@agroflete/shared';
import type { AppContext } from '../../core/app-context.js';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface HttpRequest {
  method: HttpMethod;
  path: string;
  params: Record<string, string>;
  query: Record<string, string | undefined>;
  body: unknown;
  headers: Record<string, string | undefined>;
  /** Presente cuando la ruta exige autenticación y el token es válido. */
  user?: JwtClaims;
  requestId: string;
}

export interface HttpResult {
  status: number;
  /** Cuerpo "crudo": la capa de transporte lo envuelve en `{ data }`. */
  body?: unknown;
}

export type RouteHandler = (req: HttpRequest, ctx: AppContext) => Promise<HttpResult> | HttpResult;

export interface RouteDef {
  method: HttpMethod;
  /** Ruta estilo Express: `/solicitudes/:id`. */
  path: string;
  /** `true` (default) exige un JWT válido. */
  auth?: boolean;
  /** Si se define, además exige que `user.role` esté en la lista. */
  roles?: Rol[];
  handler: RouteHandler;
}

export function ok(body?: unknown, status = 200): HttpResult {
  return { status, body };
}

export function created(body?: unknown): HttpResult {
  return { status: 201, body };
}

export function noContent(): HttpResult {
  return { status: 204 };
}
