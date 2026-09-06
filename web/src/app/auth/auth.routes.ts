import type { Routes } from '@angular/router';
import { AuthShellComponent } from './auth-shell.component';
import { ConfirmarComponent } from './confirmar.component';
import { LoginComponent } from './login.component';
import { RegistroComponent } from './registro.component';

export const authRoutes: Routes = [
  {
    path: '',
    component: AuthShellComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'login' },
      { path: 'login', component: LoginComponent, title: 'Iniciar sesión · AgroFlete' },
      { path: 'registro', component: RegistroComponent, title: 'Crear cuenta · AgroFlete' },
      { path: 'confirmar', component: ConfirmarComponent, title: 'Confirmar correo · AgroFlete' },
    ],
  },
];
