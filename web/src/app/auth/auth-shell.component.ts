import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-auth-shell',
  imports: [RouterOutlet, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-screen flex-col bg-base-200">
      <header class="container-page flex h-16 items-center">
        <a routerLink="/" class="flex items-center gap-2 font-display text-lg font-bold">
          <img src="icons/logo-64.png" alt="" class="h-8 w-8" width="32" height="32" />
          AgroFlete
        </a>
      </header>
      <main class="flex flex-1 items-center justify-center px-4 py-10">
        <div class="w-full max-w-md rounded-box bg-base-100 p-6 shadow-card sm:p-8">
          <router-outlet />
        </div>
      </main>
    </div>
  `,
})
export class AuthShellComponent {}
