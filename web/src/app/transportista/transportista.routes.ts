import type { Routes } from '@angular/router';
import { TransportistaShellComponent } from './transportista-shell.component';
import { MiVehiculoComponent } from './mi-vehiculo.component';
import { MisFletesComponent } from './mis-fletes.component';
import { PerfilComponent } from '../shared/perfil.component';

export const transportistaRoutes: Routes = [
  {
    path: '',
    component: TransportistaShellComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'fletes' },
      { path: 'vehiculo', component: MiVehiculoComponent, title: 'Mi vehículo · AgroFlete' },
      { path: 'fletes', component: MisFletesComponent, title: 'Mis fletes · AgroFlete' },
      { path: 'perfil', component: PerfilComponent, title: 'Mi perfil · AgroFlete' },
    ],
  },
];
