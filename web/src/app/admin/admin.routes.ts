import type { Routes } from '@angular/router';
import { AdminShellComponent } from './admin-shell.component';
import { ColaSolicitudesComponent } from './cola-solicitudes.component';
import { FletesAdminComponent } from './fletes-admin.component';
import { MetricasComponent } from './metricas.component';
import { TarifasComponent } from './tarifas.component';

export const adminRoutes: Routes = [
  {
    path: '',
    component: AdminShellComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'solicitudes' },
      {
        path: 'solicitudes',
        component: ColaSolicitudesComponent,
        title: 'Solicitudes · AgroFlete',
      },
      { path: 'fletes', component: FletesAdminComponent, title: 'Fletes · AgroFlete' },
      { path: 'tarifas', component: TarifasComponent, title: 'Tarifas · AgroFlete' },
      { path: 'metricas', component: MetricasComponent, title: 'Métricas · AgroFlete' },
    ],
  },
];
