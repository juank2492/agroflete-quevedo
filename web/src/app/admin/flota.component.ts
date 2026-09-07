import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ESTADOS_VEHICULO,
  TIPOS_VEHICULO,
  ZONAS,
  placaRegex,
  telefonoRegex,
  type EstadoVehiculo,
  type PerfilPublico,
  type Vehiculo,
} from '@agroflete/shared';
import { FlotaService } from '../core/flota.service';
import { UiFeedbackService } from '../core/ui-feedback.service';
import { apiMessage } from '../core/http-error';
import { IconComponent } from '../core/icon.component';
import { FiltroChipsComponent, type OpcionFiltro } from '../shared/filtro-chips.component';
import { PaginacionComponent, paginar } from '../shared/paginacion.component';
import { estadoLabel } from '../shared/estado-labels';

const POR_PAGINA = 8;

@Component({
  selector: 'app-flota',
  imports: [
    ReactiveFormsModule,
    DecimalPipe,
    IconComponent,
    FiltroChipsComponent,
    PaginacionComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-4xl space-y-8">
      <h1 class="text-2xl font-bold">Flota</h1>

      <section class="rounded-box bg-base-100 p-5 shadow-card">
        <h2 class="font-display text-lg font-semibold">Transportistas</h2>

        <form
          [formGroup]="formT"
          (ngSubmit)="crearTransportista()"
          class="mt-3 grid gap-3 sm:grid-cols-3"
        >
          <label class="form-control">
            <span class="label-text mb-1">Nombre completo</span>
            <input
              formControlName="nombreCompleto"
              class="input input-bordered"
              [class.input-error]="malo(formT.controls.nombreCompleto)"
            />
            @if (malo(formT.controls.nombreCompleto)) {
              <span class="mt-1 text-xs text-error">Mínimo 3 caracteres</span>
            }
          </label>
          <label class="form-control">
            <span class="label-text mb-1">Correo</span>
            <input
              type="email"
              formControlName="email"
              class="input input-bordered"
              [class.input-error]="malo(formT.controls.email)"
            />
            @if (malo(formT.controls.email)) {
              <span class="mt-1 text-xs text-error">Correo inválido</span>
            }
          </label>
          <label class="form-control">
            <span class="label-text mb-1">Celular</span>
            <input
              formControlName="telefono"
              placeholder="09XXXXXXXX"
              class="input input-bordered"
              [class.input-error]="malo(formT.controls.telefono)"
            />
            @if (malo(formT.controls.telefono)) {
              <span class="mt-1 text-xs text-error">Formato 09XXXXXXXX o +5939XXXXXXXX</span>
            }
          </label>
          <div class="sm:col-span-3">
            <button
              class="btn btn-primary btn-sm rounded-full"
              [disabled]="formT.invalid || guardandoT()"
            >
              <app-icon name="user" [size]="16" /> Dar de alta
            </button>
          </div>
        </form>

        @if (nuevaClave(); as nc) {
          <div class="mt-3 flex items-center gap-3 rounded-field bg-success/10 px-3 py-2 text-sm">
            <span>
              Contraseña temporal de <b>{{ nc.nombre }}</b
              >: <span class="font-mono font-semibold">{{ nc.password }}</span>
              — también le llegó por correo.
            </span>
            <button class="btn btn-ghost btn-xs" (click)="nuevaClave.set(null)">Ocultar</button>
          </div>
        }

        @if (transportistas().length) {
          <div class="mt-4">
            <app-filtro-chips
              [opciones]="opcionesT"
              [valor]="filtroT()"
              (valorChange)="cambiarFiltroT($event)"
            />
          </div>
          <div class="mt-3 overflow-x-auto">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Celular</th>
                  <th class="text-right">Vehículos</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (t of transportistasVis(); track t.id) {
                  <tr [class.opacity-50]="t.estado === 'INACTIVO'">
                    <td class="font-medium">
                      {{ t.nombreCompleto }}
                      @if (t.estado === 'INACTIVO') {
                        <span class="badge badge-ghost badge-sm ml-1">de baja</span>
                      }
                    </td>
                    <td class="text-sm">{{ t.email }}</td>
                    <td class="text-sm">{{ t.telefono }}</td>
                    <td class="text-right">{{ conteoVehiculos(t.id) }}</td>
                    <td class="text-right">
                      <button
                        class="btn btn-ghost btn-xs"
                        [disabled]="cambiandoId() === t.id"
                        (click)="alternarActividad(t)"
                      >
                        {{ t.estado === 'INACTIVO' ? 'Reactivar' : 'Dar de baja' }}
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (transportistasFiltrados().length === 0) {
            <p class="mt-2 text-sm text-base-content/60">Nadie en este filtro.</p>
          }
          <app-paginacion
            [total]="transportistasFiltrados().length"
            [pagina]="pagT()"
            [porPagina]="porPagina"
            (paginaChange)="pagT.set($event)"
          />
        }
      </section>

      <section class="rounded-box bg-base-100 p-5 shadow-card">
        <h2 class="font-display text-lg font-semibold">Vehículos</h2>
        <p class="mt-1 text-sm text-base-content/60">
          Un transportista puede tener varios. Cada vehículo solo compite por fletes de su zona.
        </p>

        @if (activos().length === 0) {
          <p class="mt-3 text-sm text-warning">Da de alta un transportista primero.</p>
        } @else {
          <form
            [formGroup]="formV"
            (ngSubmit)="crearVehiculo()"
            class="mt-3 grid gap-3 sm:grid-cols-3"
          >
            <label class="form-control">
              <span class="label-text mb-1">Transportista</span>
              <select formControlName="transportistaId" class="select select-bordered">
                <option value="">Selecciona…</option>
                @for (t of activos(); track t.id) {
                  <option [value]="t.id">{{ t.nombreCompleto }}</option>
                }
              </select>
            </label>
            <label class="form-control">
              <span class="label-text mb-1">Placa</span>
              <input
                formControlName="placa"
                placeholder="ABC-1234"
                class="input input-bordered"
                [class.input-error]="malo(formV.controls.placa)"
              />
              @if (malo(formV.controls.placa)) {
                <span class="mt-1 text-xs text-error">Formato ABC-1234 o ABC1234</span>
              }
            </label>
            <label class="form-control">
              <span class="label-text mb-1">Tipo</span>
              <select formControlName="tipo" class="select select-bordered">
                @for (tp of tipos; track tp) {
                  <option [value]="tp">{{ tp }}</option>
                }
              </select>
            </label>
            <label class="form-control">
              <span class="label-text mb-1">Capacidad (t)</span>
              <input
                type="number"
                formControlName="capacidadTon"
                step="0.5"
                min="0.5"
                max="40"
                class="input input-bordered"
                [class.input-error]="malo(formV.controls.capacidadTon)"
              />
              @if (malo(formV.controls.capacidadTon)) {
                <span class="mt-1 text-xs text-error">Entre 0.5 y 40 t</span>
              }
            </label>
            <label class="form-control">
              <span class="label-text mb-1">Zona</span>
              <select formControlName="zona" class="select select-bordered">
                @for (z of zonas; track z) {
                  <option [value]="z">{{ z }}</option>
                }
              </select>
            </label>
            <div class="flex items-end">
              <button
                class="btn btn-primary btn-sm rounded-full"
                [disabled]="formV.invalid || guardandoV()"
              >
                <app-icon name="truck" [size]="16" /> Agregar vehículo
              </button>
            </div>
          </form>
        }

        @if (vehiculos().length) {
          <div class="mt-4">
            <app-filtro-chips
              [opciones]="opcionesV"
              [valor]="filtroV()"
              (valorChange)="cambiarFiltroV($event)"
            />
          </div>
          <div class="mt-3 overflow-x-auto">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>Placa</th>
                  <th>Transportista</th>
                  <th>Zona</th>
                  <th class="text-right">Cap.</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (v of vehiculosVis(); track v.id) {
                  <tr>
                    <td class="font-mono">{{ v.placa }}</td>
                    <td class="text-sm">{{ nombreTransportista(v.transportistaId) }}</td>
                    <td>
                      <select
                        class="select select-bordered select-xs"
                        [disabled]="v.estado === 'OCUPADO' || editandoId() === v.id"
                        (change)="cambiarZona(v, $any($event.target).value)"
                      >
                        @for (z of zonas; track z) {
                          <option [value]="z" [selected]="z === v.zona">{{ z }}</option>
                        }
                      </select>
                    </td>
                    <td class="text-right">{{ v.capacidadTon | number: '1.0-1' }} t</td>
                    <td>
                      <span
                        class="badge badge-sm"
                        [class.badge-success]="v.estado === 'DISPONIBLE'"
                        [class.badge-warning]="v.estado === 'OCUPADO'"
                        [class.badge-ghost]="v.estado === 'INACTIVO'"
                      >
                        {{ v.estado }}
                      </span>
                    </td>
                    <td class="text-right">
                      @if (v.estado !== 'OCUPADO') {
                        <button
                          class="btn btn-ghost btn-xs"
                          [disabled]="editandoId() === v.id"
                          (click)="alternarEstado(v)"
                        >
                          {{ v.estado === 'DISPONIBLE' ? 'Desactivar' : 'Activar' }}
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (vehiculosFiltrados().length === 0) {
            <p class="mt-2 text-sm text-base-content/60">Sin vehículos en este filtro.</p>
          }
          <app-paginacion
            [total]="vehiculosFiltrados().length"
            [pagina]="pagV()"
            [porPagina]="porPagina"
            (paginaChange)="pagV.set($event)"
          />
        }
      </section>
    </div>
  `,
})
export class FlotaComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(FlotaService);
  private readonly feedback = inject(UiFeedbackService);

  protected readonly zonas = ZONAS;
  protected readonly tipos = TIPOS_VEHICULO;

  protected readonly transportistas = signal<PerfilPublico[]>([]);
  protected readonly vehiculos = signal<Vehiculo[]>([]);
  protected readonly guardandoT = signal(false);
  protected readonly guardandoV = signal(false);
  protected readonly editandoId = signal<string | null>(null);
  protected readonly cambiandoId = signal<string | null>(null);
  protected readonly nuevaClave = signal<{ nombre: string; password: string } | null>(null);

  protected readonly activos = computed(() =>
    this.transportistas().filter((t) => t.estado !== 'INACTIVO'),
  );
  private readonly nombrePorId = computed(
    () => new Map(this.transportistas().map((t) => [t.id, t.nombreCompleto])),
  );
  private readonly conteoPorId = computed(() => {
    const m = new Map<string, number>();
    for (const v of this.vehiculos()) m.set(v.transportistaId, (m.get(v.transportistaId) ?? 0) + 1);
    return m;
  });

  protected readonly porPagina = POR_PAGINA;
  protected readonly filtroT = signal<'TODOS' | 'ACTIVOS' | 'BAJA'>('TODOS');
  protected readonly pagT = signal(1);
  protected readonly filtroV = signal<'TODOS' | EstadoVehiculo>('TODOS');
  protected readonly pagV = signal(1);

  protected readonly opcionesT: OpcionFiltro[] = [
    { valor: 'TODOS', etiqueta: 'Todos' },
    { valor: 'ACTIVOS', etiqueta: 'Activos' },
    { valor: 'BAJA', etiqueta: 'De baja' },
  ];
  protected readonly opcionesV: OpcionFiltro[] = [
    { valor: 'TODOS', etiqueta: 'Todos' },
    ...ESTADOS_VEHICULO.map((e) => ({ valor: e, etiqueta: estadoLabel(e) })),
  ];

  protected readonly transportistasFiltrados = computed(() => {
    const f = this.filtroT();
    return this.transportistas().filter((t) =>
      f === 'ACTIVOS' ? t.estado !== 'INACTIVO' : f === 'BAJA' ? t.estado === 'INACTIVO' : true,
    );
  });
  protected readonly transportistasVis = computed(() =>
    paginar(this.transportistasFiltrados(), this.pagT(), this.porPagina),
  );

  protected readonly vehiculosFiltrados = computed(() => {
    const f = this.filtroV();
    return f === 'TODOS' ? this.vehiculos() : this.vehiculos().filter((v) => v.estado === f);
  });
  protected readonly vehiculosVis = computed(() =>
    paginar(this.vehiculosFiltrados(), this.pagV(), this.porPagina),
  );

  protected cambiarFiltroT(v: string): void {
    this.filtroT.set(v as 'TODOS' | 'ACTIVOS' | 'BAJA');
    this.pagT.set(1);
  }
  protected cambiarFiltroV(v: string): void {
    this.filtroV.set(v as 'TODOS' | EstadoVehiculo);
    this.pagV.set(1);
  }

  protected malo(c: AbstractControl): boolean {
    return c.invalid && (c.touched || c.dirty);
  }

  protected nombreTransportista(id: string): string {
    return this.nombrePorId().get(id) ?? '—';
  }
  protected conteoVehiculos(id: string): number {
    return this.conteoPorId().get(id) ?? 0;
  }

  protected readonly formT = this.fb.nonNullable.group({
    nombreCompleto: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email]],
    telefono: ['', [Validators.required, Validators.pattern(telefonoRegex)]],
  });

  protected readonly formV = this.fb.nonNullable.group({
    transportistaId: ['', [Validators.required]],
    placa: ['', [Validators.required, Validators.pattern(placaRegex)]],
    tipo: [TIPOS_VEHICULO[0], [Validators.required]],
    capacidadTon: [10, [Validators.required, Validators.min(0.5), Validators.max(40)]],
    zona: [ZONAS[0], [Validators.required]],
  });

  ngOnInit(): void {
    this.recargar();
  }

  private recargar(): void {
    this.service.listarTransportistas().subscribe({ next: (l) => this.transportistas.set(l) });
    this.service.listarVehiculos().subscribe({ next: (l) => this.vehiculos.set(l) });
  }

  protected crearTransportista(): void {
    if (this.formT.invalid) return;
    this.guardandoT.set(true);
    this.service.crearTransportista(this.formT.getRawValue()).subscribe({
      next: (r) => {
        this.guardandoT.set(false);
        this.nuevaClave.set({ nombre: r.perfil.nombreCompleto, password: r.passwordTemporal });
        this.feedback.success('Transportista dado de alta');
        this.formT.reset();
        this.recargar();
      },
      error: (err) => {
        this.guardandoT.set(false);
        this.feedback.error(apiMessage(err, 'No se pudo dar de alta'));
      },
    });
  }

  protected alternarActividad(t: PerfilPublico): void {
    const activar = t.estado === 'INACTIVO';
    this.cambiandoId.set(t.id);
    this.service.cambiarActividad(t.id, activar).subscribe({
      next: () => {
        this.cambiandoId.set(null);
        this.feedback.success(activar ? 'Transportista reactivado' : 'Transportista dado de baja');
        this.recargar();
      },
      error: (err) => {
        this.cambiandoId.set(null);
        this.feedback.error(apiMessage(err, 'No se pudo cambiar'));
      },
    });
  }

  protected crearVehiculo(): void {
    if (this.formV.invalid) return;
    this.guardandoV.set(true);
    this.service.crearVehiculo(this.formV.getRawValue()).subscribe({
      next: () => {
        this.guardandoV.set(false);
        this.feedback.success('Vehículo agregado');
        this.formV.reset({
          transportistaId: '',
          placa: '',
          tipo: TIPOS_VEHICULO[0],
          capacidadTon: 10,
          zona: ZONAS[0],
        });
        this.recargar();
      },
      error: (err) => {
        this.guardandoV.set(false);
        this.feedback.error(apiMessage(err, 'No se pudo agregar el vehículo'));
      },
    });
  }

  protected alternarEstado(v: Vehiculo): void {
    this.patch(v.id, { estado: v.estado === 'DISPONIBLE' ? 'INACTIVO' : 'DISPONIBLE' });
  }

  protected cambiarZona(v: Vehiculo, zona: string): void {
    if (zona !== v.zona) this.patch(v.id, { zona: zona as Vehiculo['zona'] });
  }

  private patch(id: string, body: Parameters<FlotaService['editarVehiculo']>[1]): void {
    this.editandoId.set(id);
    this.service.editarVehiculo(id, body).subscribe({
      next: () => {
        this.editandoId.set(null);
        this.feedback.success('Vehículo actualizado');
        this.recargar();
      },
      error: (err) => {
        this.editandoId.set(null);
        this.feedback.error(apiMessage(err, 'No se pudo actualizar'));
        this.recargar();
      },
    });
  }
}
