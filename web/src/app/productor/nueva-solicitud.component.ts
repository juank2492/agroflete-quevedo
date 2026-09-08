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
  type CrearSolicitudRequest,
  type CultivoOpcion,
  type EstimacionTarifaResponse,
  type LatLon,
  type LugarGeocodificado,
} from '@agroflete/shared';
import { IconComponent } from '../core/icon.component';
import { SolicitudService } from '../core/solicitud.service';
import { SolicitudesColaService } from '../core/solicitudes-cola.service';
import { TarifaService } from '../core/tarifa.service';
import { UiFeedbackService } from '../core/ui-feedback.service';
import { apiMessage } from '../core/http-error';
import { TarifaCardComponent } from '../shared/tarifa-card.component';
import { BuscadorLugarComponent } from '../shared/buscador-lugar.component';
import { tipoVehiculoLabel } from '../shared/vehiculo-labels';

type GeoEstado = 'pidiendo' | 'ok' | 'denegado' | 'no-soportado';

@Component({
  selector: 'app-nueva-solicitud',
  imports: [
    ReactiveFormsModule,
    DecimalPipe,
    IconComponent,
    TarifaCardComponent,
    BuscadorLugarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-md">
      <h1 class="text-2xl font-bold">Nueva solicitud</h1>
      <p class="mt-1 text-sm text-base-content/70">
        Confírmala en 3 toques: cultivo · toneladas · Confirmar.
      </p>

      <div class="mt-4 rounded-box bg-base-100 p-4 text-sm shadow-card">
        <div class="mb-2 flex items-center justify-between">
          <span class="label-text">¿Dónde está la cosecha?</span>
          <div class="join">
            <button
              type="button"
              class="btn btn-xs join-item"
              [class.btn-primary]="modoOrigen() === 'gps'"
              (click)="modoOrigen.set('gps'); pedirUbicacion()"
            >
              Mi GPS
            </button>
            <button
              type="button"
              class="btn btn-xs join-item"
              [class.btn-primary]="modoOrigen() === 'direccion'"
              (click)="modoOrigen.set('direccion')"
            >
              Escribir dirección
            </button>
          </div>
        </div>

        @if (modoOrigen() === 'direccion') {
          <app-buscador-lugar
            placeholder="Ej: Parque La Familia, recinto San Juan…"
            (selecciona)="usarLugar($event)"
            (limpia)="limpiarOrigen()"
          />
          @if (origenNombre()) {
            <p class="mt-2 flex items-center gap-1 text-xs text-success">
              <app-icon name="pin" [size]="14" /> {{ origenNombre() }}
            </p>
          } @else {
            <p class="mt-2 text-xs text-base-content/50">
              Elige un lugar de la lista para continuar.
            </p>
          }
        } @else {
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
                <span class="text-warning">
                  No pudimos obtener tu ubicación. Reintenta o escribe la dirección.
                </span>
              }
            }
          </div>
          @if (geo() === 'denegado' || geo() === 'no-soportado') {
            <button class="btn btn-ghost btn-xs mt-2" (click)="pedirUbicacion()">
              Reintentar ubicación
            </button>
          }
        }
      </div>

      <form [formGroup]="form" (ngSubmit)="confirmar()" class="mt-4 space-y-4">
        <label class="form-control w-full">
          <span class="label-text mb-1">Centro de acopio</span>
          <select formControlName="acopioId" class="select select-bordered w-full">
            <option value="" disabled>Selecciona…</option>
            @for (a of acopios(); track a.id) {
              <option [value]="a.id">{{ a.nombre }}</option>
            }
          </select>
        </label>

        <div>
          <span class="label-text mb-1 block">Cultivo</span>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
            @for (c of cultivos(); track c.clave) {
              <button
                type="button"
                class="btn"
                [class.btn-primary]="form.value.cultivo === c.clave"
                (click)="setCultivo(c.clave)"
              >
                {{ c.nombre }}
              </button>
            }
          </div>
        </div>

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

        @if (errorEstimacion(); as e) {
          <p class="rounded-field bg-error/10 px-3 py-2 text-sm text-error">{{ e }}</p>
        } @else if (estimacion(); as est) {
          <p class="text-xs text-base-content/60">
            Se transportará en <b>{{ tipoLabel(est.categoria) }}</b> (hasta
            {{ est.capacidadMaxTon }} t). El peso y el tipo de vehículo influyen en la tarifa.
          </p>
        }

        <div class="border-t border-base-300 pt-5">
          @if (!origen()) {
            <p class="mb-2 text-center text-xs text-base-content/50">
              Falta indicar dónde se recoge la cosecha.
            </p>
          }
          <button
            type="submit"
            class="btn btn-primary btn-block rounded-full"
            [disabled]="enviando() || form.invalid || !origen() || !!errorEstimacion()"
          >
            @if (enviando()) {
              <span class="loading loading-spinner loading-sm"></span>
            }
            Confirmar flete
          </button>
        </div>
      </form>
    </div>
  `,
})
export class NuevaSolicitudComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly tarifa = inject(TarifaService);
  private readonly solicitud = inject(SolicitudService);
  private readonly cola = inject(SolicitudesColaService);
  private readonly feedback = inject(UiFeedbackService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly cultivos = signal<CultivoOpcion[]>([]);
  protected readonly acopios = signal<Acopio[]>([]);
  protected readonly origen = signal<LatLon | null>(null);
  protected readonly origenNombre = signal<string | null>(null);
  protected readonly modoOrigen = signal<'gps' | 'direccion'>('gps');
  protected readonly geo = signal<GeoEstado>('pidiendo');
  protected readonly estimacion = signal<EstimacionTarifaResponse | null>(null);
  protected readonly estimando = signal(false);
  protected readonly enviando = signal(false);
  protected readonly errorEstimacion = signal<string | null>(null);
  protected readonly tipoLabel = tipoVehiculoLabel;

  protected readonly form = this.fb.nonNullable.group({
    acopioId: ['', [Validators.required]],
    cultivo: ['', [Validators.required]],
    pesoTon: [5, [Validators.required, Validators.min(0.5), Validators.max(40)]],
  });

  ngOnInit(): void {
    this.tarifa.listarAcopios().subscribe({
      next: (list) => {
        this.acopios.set(list);
        this.preseleccionarAcopio();
      },
    });
    this.tarifa.listarCultivos().subscribe({
      next: (list) => {
        this.cultivos.set(list);
        if (!this.form.controls.cultivo.value && list[0]) {
          this.form.controls.cultivo.setValue(list[0].clave);
        }
      },
    });
    this.pedirUbicacion();

    this.form.valueChanges
      .pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.estimar());
  }

  /** Fija el origen desde el lugar elegido. */
  protected usarLugar(l: LugarGeocodificado): void {
    this.origen.set({ lat: l.lat, lon: l.lon });
    this.origenNombre.set(l.etiqueta ? `${l.nombre} · ${l.etiqueta}` : l.nombre);
    this.geo.set('ok');
    this.preseleccionarAcopio();
    this.estimar();
  }

  /** Elimina el origen seleccionado. */
  protected limpiarOrigen(): void {
    this.origen.set(null);
    this.origenNombre.set(null);
    this.estimacion.set(null);
    this.errorEstimacion.set(null);
  }

  pedirUbicacion(): void {
    this.origenNombre.set(null);
    if (!('geolocation' in navigator)) {
      this.geo.set('no-soportado');
      this.origen.set(null);
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
        this.origen.set(null);
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

  protected setCultivo(clave: string): void {
    this.form.controls.cultivo.setValue(clave);
  }

  protected ajustarPeso(delta: number): void {
    const actual = this.form.controls.pesoTon.value ?? 0;
    const nuevo = Math.min(40, Math.max(0.5, Math.round((actual + delta) * 2) / 2));
    this.form.controls.pesoTon.setValue(nuevo);
  }

  private estimar(): void {
    const o = this.origen();
    const acopioId = this.form.controls.acopioId.value;
    const pesoTon = this.form.controls.pesoTon.value;
    if (!o || !acopioId || !pesoTon) return;
    this.estimando.set(true);
    this.tarifa
      .estimar({ origen: o, acopioId, cultivo: this.form.controls.cultivo.value, pesoTon })
      .subscribe({
        next: (r) => {
          this.estimacion.set(r);
          this.errorEstimacion.set(null);
          this.estimando.set(false);
        },
        error: (err) => {
          this.estimacion.set(null);
          this.errorEstimacion.set(apiMessage(err, 'No se pudo estimar la tarifa'));
          this.estimando.set(false);
        },
      });
  }

  confirmar(): void {
    const o = this.origen();
    if (this.form.invalid || !o) {
      this.form.markAllAsTouched();
      return;
    }
    const body: CrearSolicitudRequest = {
      origen: o,
      ...(this.origenNombre() ? { origenNombre: this.origenNombre()! } : {}),
      acopioId: this.form.controls.acopioId.value,
      cultivo: this.form.controls.cultivo.value,
      pesoTon: this.form.controls.pesoTon.value,
      idempotencyKey: crypto.randomUUID(),
    };
    const resumen = `${this.nombreCultivo()} · ${body.pesoTon} t → ${this.nombreAcopio()}`;

    if (!navigator.onLine) {
      void this.guardarSinConexion(body, resumen);
      return;
    }

    this.enviando.set(true);
    this.solicitud.crear(body).subscribe({
      next: (s) => {
        this.feedback.success('Solicitud publicada. Ahora paga la tarifa para que se asigne.');
        void this.router.navigate(['/p/solicitudes', s.id]);
      },
      error: (err) => {
        this.enviando.set(false);
        if (SolicitudesColaService.esFalloDeRed(err)) {
          void this.guardarSinConexion(body, resumen);
          return;
        }
        this.feedback.error(apiMessage(err, 'No se pudo publicar la solicitud'));
      },
    });
  }

  private nombreCultivo(): string {
    const c = this.form.controls.cultivo.value;
    return this.cultivos().find((x) => x.clave === c)?.nombre ?? c;
  }

  private nombreAcopio(): string {
    const a = this.form.controls.acopioId.value;
    return this.acopios().find((x) => x.id === a)?.nombre ?? 'acopio';
  }

  private async guardarSinConexion(body: CrearSolicitudRequest, resumen: string): Promise<void> {
    await this.cola.encolar({
      id: body.idempotencyKey!,
      body,
      resumen,
      createdAt: new Date().toISOString(),
    });
    this.feedback.success('Sin conexión: la solicitud se guardó y se enviará al reconectar.');
    void this.router.navigate(['/p/solicitudes']);
  }
}
