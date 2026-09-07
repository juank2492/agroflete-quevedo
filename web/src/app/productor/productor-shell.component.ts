import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { IconComponent } from '../core/icon.component';

@Component({
  selector: 'app-productor-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-screen flex-col bg-base-200">
      <header
        class="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-base-300 bg-base-100 px-4"
      >
        <a routerLink="/p" class="flex items-center gap-2 font-display font-bold">
          <img src="icons/logo-64.png" alt="" class="h-7 w-7" width="28" height="28" />
          AgroFlete
        </a>
        <div class="flex items-center gap-2">
          <a
            routerLink="/p/perfil"
            routerLinkActive="text-primary"
            class="flex items-center gap-2 rounded-full px-2 py-1 text-sm text-base-content/70 hover:bg-base-200"
          >
            <app-icon name="user" [size]="18" />
            <span class="hidden sm:inline">{{ auth.nombre() }}</span>
          </a>
          <button class="btn btn-ghost btn-sm" (click)="salir()">Salir</button>
        </div>
      </header>

      <main class="flex-1 p-4 pb-24 sm:p-6"><router-outlet /></main>

      <nav
        class="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 border-t border-base-300 bg-base-100 sm:hidden"
      >
        <a
          routerLink="/p/solicitudes"
          [routerLinkActiveOptions]="{ exact: true }"
          routerLinkActive="text-primary"
          class="flex flex-col items-center gap-1 py-2 text-base-content/70"
        >
          <app-icon name="leaf" [size]="20" />
          <span class="text-xs">Solicitudes</span>
        </a>
        <a
          routerLink="/p/solicitudes/nueva"
          routerLinkActive="text-primary"
          class="flex flex-col items-center gap-1 py-2 text-base-content/70"
        >
          <app-icon name="plus" [size]="20" />
          <span class="text-xs">Nueva</span>
        </a>
      </nav>
    </div>
  `,
})
export class ProductorShellComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  salir(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/');
  }
}
