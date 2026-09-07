import type { Routes } from '@angular/router';
import { ProductorShellComponent } from './productor-shell.component';
import { MisSolicitudesComponent } from './mis-solicitudes.component';
import { NuevaSolicitudComponent } from './nueva-solicitud.component';
import { DetalleSolicitudComponent } from './detalle-solicitud.component';
import { PerfilComponent } from '../shared/perfil.component';

export const productorRoutes: Routes = [
  {
    path: '',
    component: ProductorShellComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'solicitudes' },
      {
        path: 'solicitudes',
        pathMatch: 'full',
        component: MisSolicitudesComponent,
        title: 'Mis solicitudes · AgroFlete',
      },
      {
        path: 'solicitudes/nueva',
        component: NuevaSolicitudComponent,
        title: 'Nueva solicitud · AgroFlete',
      },
      {
        path: 'solicitudes/:id',
        component: DetalleSolicitudComponent,
        title: 'Solicitud · AgroFlete',
      },
      { path: 'perfil', component: PerfilComponent, title: 'Mi perfil · AgroFlete' },
    ],
  },
];
