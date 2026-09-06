import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime } from 'rxjs';
import {
  haversineKm,
  type Acopio,
  type Cultivo,
  type EstimacionTarifaResponse,
  type LatLon,
} from '@agroflete/shared';
import { IconComponent } from '../core/icon.component';
import { SolicitudService } from '../core/solicitud.service';
import { TarifaService } from '../core/tarifa.service';
import { UiFeedbackService } from '../core/ui-feedback.service';
import { apiMessage } from '../core/http-error';
import { TarifaCardComponent } from '../shared/tarifa-card.component';

const QUEVEDO_CENTRO: LatLon = { lat: -1.0225, lon: -79.4604 };

type GeoEstado = 'pidiendo' | 'ok' | 'denegado' | 'no-soportado';

@Component({
  selector: 'app-nueva-solicitud',
  imports: [ReactiveFormsModule, DecimalPipe, IconComponent, TarifaCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-md">
      <h1 class="text-2xl font-bold">Nueva solicitud</h1>
      <p class="mt-1 text-sm text-base-content/70">
        Confírmala en 3 toques: cultivo · toneladas · Confirmar.
      </p>

      <!-- ORIGEN -->
      <div class="mt-4 rounded-box bg-base-100 p-4 text-sm shadow-card">
        <div class="flex items-center gap-2">
          <app-icon name="pin" [size]="18" class="text-primary" />
          @switch (geo()) {
            @case ('pidiendo') {
              <span class="text-base-content/60">Obteniendo tu ubicación…</span>
            }
            @case ('ok') {
              <span>
                Origen: {{ origen()!.lat | number: '1.4-4' }},
                {{ origen()!.lon | number: '1.4-4' }}
              </span>
            }
            @default {
              <span class="text-base-content/70"> Sin ubicación GPS: usamos Quevedo centro. </span>
            }
          }
        </div>
        @if (geo() === 'denegado' || geo() === 'no-soportado') {
          <button class="btn btn-ghost btn-xs mt-2" (click)="pedirUbicacion()">
            Reintentar ubicación
          </button>
        }
      </div>

      <form [formGroup]="form" (ngSubmit)="confirmar()" class="mt-4 space-y-4">
        <!-- DESTINO -->
        <label class="form-control w-full">
          <span class="label-text mb-1">Centro de acopio</span>
          <select formControlName="acopioId" class="select select-bordered w-full">
            <option value="" disabled>Selecciona…</option>
            @for (a of acopios(); track a.id) {
              <option [value]="a.id">{{ a.nombre }}</option>
            }
          </select>
        </label>

        <!-- CULTIVO (toque 1) -->
        <div>
          <span class="label-text mb-1 block">Cultivo</span>
          <div class="join w-full">
            @for (c of cultivos; track c.valor) {
              <button
                type="button"
                class="btn join-item flex-1"
                [class.btn-primary]="form.value.cultivo === c.valor"
                (click)="setCultivo(c.valor)"
              >
                {{ c.label }}
              </button>
            }
          </div>
        </div>

        <!-- TONELADAS (toque 2) -->
        <div>
          <span class="label-text mb-1 block">Toneladas</span>
          <div class="join">
            <button type="button" class="btn join-item" (click)="ajustarPeso(-1)">
              <app-icon name="minus" [size]="16" />
            </button>
            <input
              type="number"
              formControlName="pesoTon"
              step="0.5"
              min="0.5"
              max="40"
              class="input input-bordered join-item w-24 text-center"
            />
            <button type="button" class="btn join-item" (click)="ajustarPeso(1)">
              <app-icon name="plus" [size]="16" />
            </button>
          </div>
        </div>

        <app-tarifa-card
          [tarifa]="estimacion()?.tarifa ?? null"
          [distanciaKm]="estimacion()?.distanciaKm ?? 0"
          [enTemporada]="estimacion()?.enTemporada ?? false"
          [cargando]="estimando()"
        />

        <!-- CONFIRMAR (toque 3) -->
        <button
          type="submit"
          class="btn btn-primary btn-block rounded-full"
          [disabled]="enviando() || form.invalid || !origen()"
        >
          @if (enviando()) {
            <span class="loading loading-spinner loading-sm"></span>
          }
          Confirmar flete
        </button>
      </form>
    </div>
  `,
})
export class NuevaSolicitudComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly tarifa = inject(TarifaService);
  private readonly solicitud = inject(SolicitudService);
  private readonly feedback = inject(UiFeedbackService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly cultivos: Array<{ valor: Cultivo; label: string }> = [
    { valor: 'maiz', label: 'Maíz' },
    { valor: 'banano', label: 'Banano' },
  ];

  protected readonly acopios = signal<Acopio[]>([]);
  protected readonly origen = signal<LatLon | null>(null);
  protected readonly geo = signal<GeoEstado>('pidiendo');
  protected readonly estimacion = signal<EstimacionTarifaResponse | null>(null);
  protected readonly estimando = signal(false);
  protected readonly enviando = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    acopioId: ['', [Validators.required]],
    cultivo: ['maiz' as Cultivo, [Validators.required]],
    pesoTon: [5, [Validators.required, Validators.min(0.5), Validators.max(40)]],
  });

  ngOnInit(): void {
    this.tarifa.listarAcopios().subscribe({
      next: (list) => {
        this.acopios.set(list);
        this.preseleccionarAcopio();
      },
    });
    this.pedirUbicacion();

    this.form.valueChanges
      .pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.estimar());
  }

  pedirUbicacion(): void {
    if (!('geolocation' in navigator)) {
      this.geo.set('no-soportado');
      this.origen.set(QUEVEDO_CENTRO);
      this.preseleccionarAcopio();
      return;
    }
    this.geo.set('pidiendo');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.origen.set({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        this.geo.set('ok');
        this.preseleccionarAcopio();
        this.estimar();
      },
      () => {
        this.geo.set('denegado');
        this.origen.set(QUEVEDO_CENTRO);
        this.preseleccionarAcopio();
        this.estimar();
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  private preseleccionarAcopio(): void {
    const o = this.origen();
    const lista = this.acopios();
    if (!o || lista.length === 0 || this.form.controls.acopioId.value) return;
    const cercano = [...lista].sort(
      (a, b) =>
        haversineKm(o, { lat: a.lat, lon: a.lon }) - haversineKm(o, { lat: b.lat, lon: b.lon }),
    )[0];
    if (cercano) this.form.controls.acopioId.setValue(cercano.id);
  }

  protected setCultivo(c: Cultivo): void {
    this.form.controls.cultivo.setValue(c);
  }

  protected ajustarPeso(delta: number): void {
    const actual = this.form.controls.pesoTon.value ?? 0;
    const nuevo = Math.min(40, Math.max(0.5, Math.round((actual + delta) * 2) / 2));
    this.form.controls.pesoTon.setValue(nuevo);
  }

  private estimar(): void {
    const o = this.origen();
    const acopioId = this.form.controls.acopioId.value;
    if (!o || !acopioId) return;
    this.estimando.set(true);
    this.tarifa
      .estimar({ origen: o, acopioId, cultivo: this.form.controls.cultivo.value })
      .subscribe({
        next: (r) => {
          this.estimacion.set(r);
          this.estimando.set(false);
        },
        error: () => this.estimando.set(false),
      });
  }

  confirmar(): void {
    const o = this.origen();
    if (this.form.invalid || !o) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.solicitud
      .crear({
        origen: o,
        acopioId: this.form.controls.acopioId.value,
        cultivo: this.form.controls.cultivo.value,
        pesoTon: this.form.controls.pesoTon.value,
      })
      .subscribe({
        next: (s) => {
          this.feedback.success('Solicitud publicada');
          void this.router.navigate(['/p/solicitudes', s.id]);
        },
        error: (err) => {
          this.enviando.set(false);
          this.feedback.error(apiMessage(err, 'No se pudo publicar la solicitud'));
        },
      });
  }
}
