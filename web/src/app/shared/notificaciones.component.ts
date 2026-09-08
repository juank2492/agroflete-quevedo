import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { interval } from 'rxjs';
import type { Notificacion } from '@agroflete/shared';
import { IconComponent } from '../core/icon.component';
import { NotificacionService } from '../core/notificacion.service';
import { PushService } from '../core/push.service';
import { haceTexto } from './tracking.util';

/** Panel de notificaciones in-app. */
@Component({
  selector: 'app-notificaciones',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dropdown dropdown-end">
      <button
        tabindex="0"
        class="btn btn-ghost btn-circle btn-sm"
        [attr.aria-label]="'Notificaciones (' + noLeidas() + ' sin leer)'"
      >
        <span class="indicator">
          @if (noLeidas() > 0) {
            <span class="indicator-item badge badge-error badge-xs">{{ noLeidas() }}</span>
          }
          <app-icon name="bell" [size]="20" />
        </span>
      </button>

      <div
        tabindex="0"
        class="dropdown-content z-50 mt-2 max-h-[70vh] w-80 overflow-y-auto rounded-box border border-base-300 bg-base-100 shadow-card"
      >
        <div class="flex items-center justify-between border-b border-base-300 px-4 py-2">
          <span class="text-sm font-semibold">Notificaciones</span>
          @if (noLeidas() > 0) {
            <button class="btn btn-ghost btn-xs" (click)="marcarTodas()">Marcar todas</button>
          }
        </div>

        @if (items().length === 0) {
          <p class="px-4 py-6 text-center text-sm text-base-content/60">Sin avisos.</p>
        } @else {
          <ul class="divide-y divide-base-200">
            @for (n of items(); track n.id) {
              <li>
                <button
                  type="button"
                  class="flex w-full gap-2 px-4 py-3 text-left hover:bg-base-200"
                  (click)="abrir(n)"
                >
                  <span
                    class="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    [class.bg-primary]="!n.leidoEn"
                    [class.bg-transparent]="!!n.leidoEn"
                  ></span>
                  <span class="min-w-0 flex-1">
                    <span
                      class="block text-sm font-medium"
                      [class.text-base-content/60]="!!n.leidoEn"
                    >
                      {{ n.titulo }}
                    </span>
                    <span class="block text-xs text-base-content/70">{{ n.cuerpo }}</span>
                    <span class="mt-0.5 block text-[11px] text-base-content/45">
                      {{ hace(n.createdAt) }}
                    </span>
                  </span>
                </button>
              </li>
            }
          </ul>
        }
      </div>
    </div>
  `,
})
export class NotificacionesComponent implements OnInit {
  private readonly service = inject(NotificacionService);
  private readonly push = inject(PushService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly items = signal<Notificacion[]>([]);
  protected readonly noLeidas = computed(() => this.items().filter((n) => !n.leidoEn).length);

  ngOnInit(): void {
    this.recargar();
    void this.push.activar();
    interval(30_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.recargar());
  }

  protected hace(iso: string): string {
    return haceTexto(iso);
  }

  private recargar(): void {
    this.service.listar().subscribe({ next: (l) => this.items.set(l) });
  }

  protected abrir(n: Notificacion): void {
    if (!n.leidoEn) {
      this.service.marcarLeida(n.id).subscribe();
      this.items.update((l) =>
        l.map((x) => (x.id === n.id ? { ...x, leidoEn: new Date().toISOString() } : x)),
      );
    }
    (document.activeElement as HTMLElement | null)?.blur();
    if (n.enlace) void this.router.navigateByUrl(n.enlace);
  }

  protected marcarTodas(): void {
    this.service.marcarTodasLeidas().subscribe();
    const now = new Date().toISOString();
    this.items.update((l) => l.map((x) => (x.leidoEn ? x : { ...x, leidoEn: now })));
  }
}
