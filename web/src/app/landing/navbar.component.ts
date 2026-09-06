import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { IconComponent } from '../core/icon.component';

@Component({
  selector: 'app-landing-navbar',
  imports: [RouterLink, RouterLinkActive, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="sticky top-0 z-40 border-b border-base-300/70 bg-base-100/85 backdrop-blur">
      <nav class="container-page flex h-16 items-center justify-between gap-4">
        <a routerLink="/" class="flex items-center gap-2 font-display text-lg font-bold">
          <img src="icons/logo-64.png" alt="" class="h-8 w-8" width="32" height="32" />
          AgroFlete
        </a>

        <div class="hidden items-center gap-1 md:flex">
          <a
            routerLink="/"
            routerLinkActive="text-primary"
            [routerLinkActiveOptions]="{ exact: true }"
            class="btn btn-ghost btn-sm"
            >Inicio</a
          >
          <a
            routerLink="/como-funciona"
            routerLinkActive="text-primary"
            class="btn btn-ghost btn-sm"
            >Cómo funciona</a
          >
          <a routerLink="/contacto" routerLinkActive="text-primary" class="btn btn-ghost btn-sm"
            >Contacto</a
          >
        </div>

        <div class="hidden items-center gap-2 md:flex">
          @if (auth.isAuthenticated()) {
            <a [routerLink]="auth.homePath()" class="btn btn-primary btn-sm rounded-full">
              Mi panel <app-icon name="arrow" [size]="16" />
            </a>
          } @else {
            <a routerLink="/auth/login" class="btn btn-ghost btn-sm">Ingresar</a>
            <a routerLink="/auth/registro" class="btn btn-primary btn-sm rounded-full"
              >Crear cuenta</a
            >
          }
        </div>

        <button
          class="btn btn-ghost btn-square md:hidden"
          (click)="abierto.set(!abierto())"
          [attr.aria-expanded]="abierto()"
          aria-label="Menú"
        >
          <app-icon [name]="abierto() ? 'x' : 'menu'" />
        </button>
      </nav>

      @if (abierto()) {
        <div class="border-t border-base-300/70 bg-base-100 md:hidden">
          <div class="container-page flex flex-col gap-1 py-3" (click)="abierto.set(false)">
            <a routerLink="/" class="btn btn-ghost btn-sm justify-start">Inicio</a>
            <a routerLink="/como-funciona" class="btn btn-ghost btn-sm justify-start"
              >Cómo funciona</a
            >
            <a routerLink="/contacto" class="btn btn-ghost btn-sm justify-start">Contacto</a>
            <div class="divider my-1"></div>
            @if (auth.isAuthenticated()) {
              <a [routerLink]="auth.homePath()" class="btn btn-primary btn-sm rounded-full"
                >Mi panel</a
              >
            } @else {
              <a routerLink="/auth/login" class="btn btn-ghost btn-sm justify-start">Ingresar</a>
              <a routerLink="/auth/registro" class="btn btn-primary btn-sm rounded-full"
                >Crear cuenta</a
              >
            }
          </div>
        </div>
      }
    </header>
  `,
})
export class LandingNavbarComponent {
  protected readonly auth = inject(AuthService);
  protected readonly abierto = signal(false);
}
