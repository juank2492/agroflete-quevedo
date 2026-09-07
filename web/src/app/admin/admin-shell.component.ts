import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { IconComponent } from '../core/icon.component';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-screen bg-base-200">
      <aside
        class="hidden w-60 shrink-0 flex-col gap-1 border-r border-base-300 bg-base-100 p-4 md:flex"
      >
        <a routerLink="/" class="mb-4 flex items-center gap-2 font-display text-lg font-bold">
          <img src="icons/logo-64.png" alt="" class="h-7 w-7" width="28" height="28" />
          AgroFlete
        </a>
        @for (item of nav; track item.path) {
          <a
            [routerLink]="item.path"
            routerLinkActive="bg-primary/10 text-primary"
            class="flex items-center gap-3 rounded-field px-3 py-2 text-sm hover:bg-base-200"
          >
            <app-icon [name]="item.icon" [size]="18" />
            {{ item.label }}
          </a>
        }
      </aside>

      <div class="flex min-w-0 flex-1 flex-col">
        <header
          class="flex h-14 items-center justify-between border-b border-base-300 bg-base-100 px-4"
        >
          <div class="dropdown md:hidden">
            <button tabindex="0" class="btn btn-ghost btn-square btn-sm" aria-label="Menú">
              <app-icon name="menu" />
            </button>
            <ul
              tabindex="0"
              class="menu dropdown-content z-50 mt-2 w-52 rounded-box bg-base-100 p-2 shadow-card"
            >
              @for (item of nav; track item.path) {
                <li>
                  <a [routerLink]="item.path">{{ item.label }}</a>
                </li>
              }
            </ul>
          </div>
          <span class="text-sm font-semibold">Panel de administración</span>
          <div class="flex items-center gap-3">
            <span class="hidden text-sm text-base-content/70 sm:inline">{{ auth.nombre() }}</span>
            <button class="btn btn-ghost btn-sm" (click)="salir()">Salir</button>
          </div>
        </header>
        <main class="flex-1 p-4 sm:p-6"><router-outlet /></main>
      </div>
    </div>
  `,
})
export class AdminShellComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly nav: NavItem[] = [
    { path: 'solicitudes', label: 'Solicitudes', icon: 'leaf' },
    { path: 'fletes', label: 'Fletes', icon: 'truck' },
    { path: 'flota', label: 'Flota', icon: 'users' },
    { path: 'inventario', label: 'Inventario', icon: 'box' },
    { path: 'tarifas', label: 'Tarifas', icon: 'chart' },
    { path: 'metricas', label: 'Métricas', icon: 'chart' },
    { path: 'ajustes', label: 'Ajustes', icon: 'sliders' },
    { path: 'perfil', label: 'Mi perfil', icon: 'user' },
  ];

  salir(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/');
  }
}
