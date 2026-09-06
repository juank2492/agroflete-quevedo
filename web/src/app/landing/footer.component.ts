import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing-footer',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="border-t border-base-300/70 bg-base-100">
      <div class="container-page grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div class="space-y-3">
          <div class="flex items-center gap-2 font-display text-lg font-bold">
            <img src="icons/logo-64.png" alt="" class="h-7 w-7" width="28" height="28" />
            AgroFlete
          </div>
          <p class="text-sm text-base-content/70">
            Coordina fletes agrícolas en Quevedo con tarifas claras y seguimiento en tiempo real.
          </p>
        </div>

        <div>
          <h3 class="mb-2 text-sm font-semibold uppercase tracking-wide text-base-content/60">
            Plataforma
          </h3>
          <ul class="space-y-1 text-sm">
            <li><a routerLink="/como-funciona" class="link link-hover">Cómo funciona</a></li>
            <li><a routerLink="/auth/registro" class="link link-hover">Crear cuenta</a></li>
            <li><a routerLink="/auth/login" class="link link-hover">Ingresar</a></li>
          </ul>
        </div>

        <div>
          <h3 class="mb-2 text-sm font-semibold uppercase tracking-wide text-base-content/60">
            Contacto
          </h3>
          <ul class="space-y-1 text-sm text-base-content/70">
            <li>Quevedo, Los Ríos — Ecuador</li>
            <li><a routerLink="/contacto" class="link link-hover">Formulario de contacto</a></li>
          </ul>
        </div>

        <div>
          <h3 class="mb-2 text-sm font-semibold uppercase tracking-wide text-base-content/60">
            Proyecto
          </h3>
          <p class="text-sm text-base-content/70">
            Proyecto Integrador — Ingeniería en Software, UNIANDES. Arquitectura serverless.
          </p>
        </div>
      </div>
      <div class="border-t border-base-300/70">
        <div class="container-page py-4 text-center text-xs text-base-content/60">
          © {{ anio }} AgroFlete Quevedo · Uso académico
        </div>
      </div>
    </footer>
  `,
})
export class LandingFooterComponent {
  protected readonly anio = new Date().getFullYear();
}
