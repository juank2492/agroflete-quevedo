import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LandingNavbarComponent } from './navbar.component';
import { LandingFooterComponent } from './footer.component';

@Component({
  selector: 'app-landing-shell',
  imports: [RouterOutlet, LandingNavbarComponent, LandingFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-screen flex-col">
      <app-landing-navbar />
      <main class="flex-1">
        <router-outlet />
      </main>
      <app-landing-footer />
    </div>
  `,
})
export class LandingShellComponent {}
