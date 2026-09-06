import { Routes } from '@angular/router';
import { roleGuard } from './core/role.guard';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./landing/landing.routes').then((m) => m.landingRoutes),
  },
  {
    path: 'auth',
    loadChildren: () => import('./auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: 'p',
    canMatch: [roleGuard(['productor'])],
    loadChildren: () => import('./productor/productor.routes').then((m) => m.productorRoutes),
  },
  {
    path: 't',
    canMatch: [roleGuard(['transportista'])],
    loadChildren: () =>
      import('./transportista/transportista.routes').then((m) => m.transportistaRoutes),
  },
  {
    path: 'a',
    canMatch: [roleGuard(['admin'])],
    loadChildren: () => import('./admin/admin.routes').then((m) => m.adminRoutes),
  },
  { path: '**', redirectTo: '' },
];
