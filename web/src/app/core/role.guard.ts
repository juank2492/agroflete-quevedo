import { inject } from '@angular/core';
import { Router, type CanMatchFn } from '@angular/router';
import type { Rol } from '@agroflete/shared';
import { SessionStore } from './session';

/** Permite la ruta solo si hay sesión y el rol está en `roles`. */
export function roleGuard(roles: Rol[]): CanMatchFn {
  return () => {
    const session = inject(SessionStore);
    const router = inject(Router);

    if (!session.isAuthenticated()) {
      return router.createUrlTree(['/auth/login']);
    }
    const rol = session.role();
    if (rol && roles.includes(rol)) return true;

    return router.createUrlTree([session.homePath()]);
  };
}
