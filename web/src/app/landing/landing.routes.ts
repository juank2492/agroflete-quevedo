import type { Routes } from '@angular/router';
import { LandingShellComponent } from './landing-shell.component';
import { HomeComponent } from './home.component';
import { ComoFuncionaComponent } from './como-funciona.component';
import { ContactoComponent } from './contacto.component';

export const landingRoutes: Routes = [
  {
    path: '',
    component: LandingShellComponent,
    children: [
      { path: '', component: HomeComponent, title: 'AgroFlete Quevedo' },
      {
        path: 'como-funciona',
        component: ComoFuncionaComponent,
        title: 'Cómo funciona · AgroFlete',
      },
      { path: 'contacto', component: ContactoComponent, title: 'Contacto · AgroFlete' },
    ],
  },
];
