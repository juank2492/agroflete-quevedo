import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import { ERROR_STATUS, fail, ok as okEnvelope, type ApiError } from '@agroflete/shared';
import type { AppContext } from '../../adapters/config/context.js';
import { env } from '../../adapters/config/env.js';
import { ForbiddenError, UnauthenticatedError, isDomainError } from '../../core/domain/errors.js';
import { routes } from '../http/routes/index.js';
import type { HttpMethod, HttpRequest, RouteDef } from '../http/types.js';

function bearerToken(req: Request): string | undefined {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) return undefined;
  return header.slice('Bearer '.length).trim() || undefined;
}

function toApiError(err: unknown): { status: number; error: ApiError } {
  if (err instanceof ZodError) {
    return {
      status: ERROR_STATUS.VALIDATION,
      error: {
        code: 'VALIDATION',
        message: 'Datos inválidos',
        details: { issues: err.issues },
      },
    };
  }
  if (isDomainError(err)) {
    return {
      status: ERROR_STATUS[err.code],
      error: { code: err.code, message: err.message, details: err.details },
    };
  }
  return {
    status: 500,
    error: { code: 'INTERNAL', message: 'Error interno del servidor' },
  };
}

function makeHandler(route: RouteDef, ctx: AppContext) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const httpReq: HttpRequest = {
        method: req.method as HttpMethod,
        path: req.path,
        params: req.params as Record<string, string>,
        query: req.query as Record<string, string | undefined>,
        body: req.body,
        headers: req.headers as Record<string, string | undefined>,
        requestId: (req as Request & { id?: string }).id ?? randomUUID(),
      };

      if (route.auth !== false) {
        const token = bearerToken(req);
        if (!token) throw new UnauthenticatedError();
        try {
          httpReq.user = ctx.tokens.verify(token);
        } catch {
          throw new UnauthenticatedError('Token inválido o expirado');
        }
        if (route.roles && !route.roles.includes(httpReq.user.role)) {
          throw new ForbiddenError('Tu rol no puede realizar esta acción');
        }
      }

      const result = await route.handler(httpReq, ctx);
      if (result.status === 204 || result.body === undefined) {
        res.status(result.status).end();
        return;
      }
      res.status(result.status).json(okEnvelope(result.body));
    } catch (err) {
      next(err);
    }
  };
}

export function createApp(ctx: AppContext) {
  const app = express();
  app.disable('x-powered-by');

  app.use((req, _res, next) => {
    (req as Request & { id?: string }).id = req.header('x-request-id') ?? randomUUID();
    next();
  });
  app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '64kb' }));

  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      ctx.logger.info(
        {
          reqId: (req as Request & { id?: string }).id,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          ms: Date.now() - start,
        },
        'http',
      );
    });
    next();
  });

  const router = express.Router();
  for (const route of routes) {
    const method = route.method.toLowerCase() as Lowercase<HttpMethod>;
    router[method](route.path, makeHandler(route, ctx));
  }
  app.use(router);

  app.use((_req, res) => {
    res.status(404).json(fail({ code: 'NOT_FOUND', message: 'Ruta no encontrada' }));
  });

  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const { status, error } = toApiError(err);
    if (status >= 500) {
      ctx.logger.error(
        {
          reqId: (req as Request & { id?: string }).id,
          err: err instanceof Error ? err.stack : err,
        },
        'unhandled error',
      );
    }
    res.status(status).json(fail(error));
  });

  return app;
}
