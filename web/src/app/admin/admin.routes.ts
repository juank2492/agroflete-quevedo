import type { Routes } from '@angular/router';
import { AdminShellComponent } from './admin-shell.component';
import { ColaSolicitudesComponent } from './cola-solicitudes.component';
import { FletesAdminComponent } from './fletes-admin.component';
import { FlotaComponent } from './flota.component';
import { MetricasComponent } from './metricas.component';
import { TarifasComponent } from './tarifas.component';
import { InventarioComponent } from './inventario.component';
import { AjustesComponent } from './ajustes.component';
import { PerfilComponent } from '../shared/perfil.component';
import { unsavedChangesGuard } from '../shared/unsaved-changes.guard';

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
      { path: 'flota', component: FlotaComponent, title: 'Flota · AgroFlete' },
      { path: 'inventario', component: InventarioComponent, title: 'Inventario · AgroFlete' },
      {
        path: 'tarifas',
        component: TarifasComponent,
        title: 'Tarifas · AgroFlete',
        canDeactivate: [unsavedChangesGuard],
      },
      { path: 'metricas', component: MetricasComponent, title: 'Métricas · AgroFlete' },
      { path: 'ajustes', component: AjustesComponent, title: 'Ajustes · AgroFlete' },
      { path: 'perfil', component: PerfilComponent, title: 'Mi perfil · AgroFlete' },
    ],
  },
];
