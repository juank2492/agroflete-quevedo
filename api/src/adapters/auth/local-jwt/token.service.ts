import jwt from 'jsonwebtoken';
import { jwtClaimsSchema } from '@agroflete/shared';
import type { TokenService } from '../../../core/ports/services.js';

/**
 * Emite/verifica JWT HS256 con un secreto local. En la Fase A se sustituye por
 * un verificador contra el JWKS de Cognito, sin tocar los casos de uso.
 */
export function makeLocalTokenService(secret: string, expiresIn: string): TokenService {
  return {
    sign: (claims) =>
      jwt.sign(claims, secret, { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] }),
    verify: (token) => jwtClaimsSchema.parse(jwt.verify(token, secret)),
  };
}
