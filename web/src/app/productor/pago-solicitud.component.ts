import {
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  marcaDeTarjeta,
  pagoDe,
  tarjetaVencida,
  type MarcaTarjeta,
  type Solicitud,
} from '@agroflete/shared';
import { PagoService } from '../core/pago.service';
import { UiFeedbackService } from '../core/ui-feedback.service';
import { apiMessage } from '../core/http-error';
import { IconComponent } from '../core/icon.component';

const TARJETA = /^\d{13,19}$/;
const MMAA = /^(0[1-9]|1[0-2])\/\d{2}$/;

const BANCOS_EC = [
  'Banco Pichincha',
  'Banco Guayaquil',
  'Produbanco',
  'Banco del Pacífico',
  'Banco Internacional',
  'Banco Bolivariano',
  'Banco del Austro',
  'Banco de Machala',
  'Banco de Loja',
  'Banco Solidario',
  'Banco ProCredit',
  'Banco Amazonas',
  'BanEcuador',
  'Cooperativa JEP',
  'Cooperativa Jardín Azuayo',
  'Cooperativa Policía Nacional',
  'Cooperativa 29 de Octubre',
  'Cooperativa Alianza del Valle',
];
const MARCA_ETIQUETA: Record<MarcaTarjeta, string> = {
  visa: 'VISA',
  mastercard: 'Mastercard',
  otra: 'Tarjeta',
};

function enmascarar(v: string): string {
  return (
    v
      .replace(/\D/g, '')
      .slice(0, 19)
      .match(/.{1,4}/g)
      ?.join(' ') ?? ''
  );
}

@Component({
  selector: 'app-pago-solicitud',
  imports: [ReactiveFormsModule, DecimalPipe, IconComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .cally-pop {
      inset: auto;
      margin: 0;
      border: 0;
      padding: 0;
      max-width: calc(100vw - 16px);
      background: transparent;
      overflow: visible;
    }
  `,
  template: `
    @let p = pago();
    <div class="rounded-box bg-base-100 p-5 shadow-card">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="font-semibold">Pago de la tarifa</h2>
          @switch (p.estado) {
            @case ('PAGADO') {
              <p class="mt-1 flex items-center gap-1.5 text-sm text-success">
                <app-icon name="check" [size]="15" />
                Pagado
                {{ p.metodo === 'DEPOSITO' ? 'por depósito' : 'con tarjeta' }} · ref.
                {{ p.referencia }}
              </p>
            }
            @case ('EN_REVISION') {
              <p class="mt-1 text-sm text-info">
                Depósito <b>en revisión</b> por la comercializadora.
              </p>
            }
            @case ('RECHAZADO') {
              <p class="mt-1 text-sm text-error">
                Pago rechazado{{ p.nota ? ' · ' + p.nota : '' }}.
              </p>
            }
            @default {
              <p class="mt-1 text-sm text-base-content/60">
                La solicitud no se asigna hasta registrar el pago.
              </p>
            }
          }
        </div>
        <span class="font-display text-xl font-bold text-primary">
          $ {{ p.monto ?? solicitud().tarifaEstimada | number: '1.2-2' }}
        </span>
      </div>

      @if (p.estado === 'PENDIENTE' || p.estado === 'RECHAZADO') {
        <button class="btn btn-primary btn-block mt-4 rounded-full" (click)="abrir()">
          {{ p.estado === 'RECHAZADO' ? 'Reintentar pago' : 'Pagar tarifa' }}
        </button>
      }
    </div>

    <dialog class="modal" [class.modal-open]="abierto()">
      <div class="modal-box">
        <h3 class="text-lg font-bold">
          Pagar $ {{ p.monto ?? solicitud().tarifaEstimada | number: '1.2-2' }}
        </h3>

        <div class="mt-3 flex gap-2">
          <button
            class="btn btn-sm rounded-full"
            [class.btn-primary]="metodo() === 'tarjeta'"
            [class.btn-ghost]="metodo() !== 'tarjeta'"
            (click)="metodo.set('tarjeta')"
          >
            Tarjeta
          </button>
          <button
            class="btn btn-sm rounded-full"
            [class.btn-primary]="metodo() === 'deposito'"
            [class.btn-ghost]="metodo() !== 'deposito'"
            (click)="metodo.set('deposito')"
          >
            Depósito / transferencia
          </button>
        </div>

        @if (metodo() === 'tarjeta') {
          <form [formGroup]="formT" (ngSubmit)="pagarTarjeta()" class="mt-4 space-y-3">
            <div class="flex gap-2">
              <label class="flex cursor-pointer items-center gap-2 text-sm">
                <input type="radio" class="radio radio-sm" formControlName="tipo" value="credito" />
                Crédito
              </label>
              <label class="flex cursor-pointer items-center gap-2 text-sm">
                <input type="radio" class="radio radio-sm" formControlName="tipo" value="debito" />
                Débito
              </label>
            </div>

            <label class="form-control w-full">
              <span class="label-text mb-1">Titular</span>
              <input
                formControlName="titular"
                autocomplete="cc-name"
                placeholder="Como aparece en la tarjeta"
                class="input input-bordered w-full"
                [class.input-error]="malo(formT.controls.titular)"
              />
            </label>

            <label class="form-control w-full">
              <span class="label-text mb-1">Número de tarjeta</span>
              <div class="relative">
                <input
                  [value]="numeroVista()"
                  (input)="onNumero($event)"
                  inputmode="numeric"
                  autocomplete="cc-number"
                  placeholder="1234 5678 9012 3456"
                  maxlength="23"
                  class="input input-bordered w-full pr-20 font-mono tracking-wider"
                  [class.input-error]="malo(formT.controls.numeroTarjeta)"
                />
                <span
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-base-content/50"
                >
                  {{ marcaEtiqueta() }}
                </span>
              </div>
              @if (malo(formT.controls.numeroTarjeta)) {
                <span class="mt-1 text-xs text-error">Número inválido (13 a 19 dígitos)</span>
              }
            </label>

            <div class="grid grid-cols-2 gap-3">
              <label class="form-control">
                <span class="label-text mb-1">Vence (MM/AA)</span>
                <input
                  [value]="expVista()"
                  (input)="onExp($event)"
                  inputmode="numeric"
                  autocomplete="cc-exp"
                  placeholder="MM/AA"
                  maxlength="5"
                  class="input input-bordered font-mono"
                  [class.input-error]="malo(formT.controls.expiracion)"
                />
                @if (malo(formT.controls.expiracion)) {
                  <span class="mt-1 text-xs text-error">{{ errorExp() }}</span>
                }
              </label>
              <label class="form-control">
                <span class="label-text mb-1">CVV</span>
                <input
                  formControlName="cvv"
                  inputmode="numeric"
                  autocomplete="cc-csc"
                  placeholder="123"
                  maxlength="4"
                  class="input input-bordered font-mono"
                  [class.input-error]="malo(formT.controls.cvv)"
                />
              </label>
            </div>

            <div class="modal-action">
              <button type="button" class="btn btn-ghost" (click)="cerrar()">Cancelar</button>
              <button class="btn btn-primary rounded-full" [disabled]="formT.invalid || enviando()">
                @if (enviando()) {
                  <span class="loading loading-spinner loading-sm"></span>
                }
                Pagar
              </button>
            </div>
          </form>
        } @else {
          <form [formGroup]="formD" (ngSubmit)="registrarDeposito()" class="mt-4 space-y-3">
            <div class="grid gap-3 sm:grid-cols-2">
              <label class="form-control">
                <span class="label-text mb-1">Banco</span>
                <input
                  formControlName="banco"
                  list="bancos-ec"
                  autocomplete="off"
                  placeholder="Escribe y elige…"
                  class="input input-bordered"
                  [class.input-error]="malo(formD.controls.banco)"
                />
                <datalist id="bancos-ec">
                  @for (b of bancos; track b) {
                    <option [value]="b"></option>
                  }
                </datalist>
              </label>
              <label class="form-control">
                <span class="label-text mb-1">Nº de comprobante</span>
                <input
                  formControlName="referencia"
                  class="input input-bordered"
                  [class.input-error]="malo(formD.controls.referencia)"
                />
              </label>
              <label class="form-control">
                <span class="label-text mb-1">Monto depositado</span>
                <input
                  type="number"
                  step="0.01"
                  formControlName="monto"
                  class="input input-bordered"
                  [class.input-error]="malo(formD.controls.monto)"
                />
              </label>
              <div class="form-control">
                <span class="label-text mb-1">Fecha del depósito</span>
                <button
                  #calBtn
                  type="button"
                  class="input input-bordered flex w-full items-center justify-between"
                  [class.input-error]="malo(formD.controls.fecha)"
                  (click)="alternarCal()"
                >
                  <span [class.opacity-50]="!formD.controls.fecha.value">
                    {{ formD.controls.fecha.value || 'Elegir fecha' }}
                  </span>
                  <app-icon name="calendar" [size]="16" class="opacity-60" />
                </button>
              </div>
            </div>

            <div #calPop popover class="cally-pop">
              <div class="rounded-box border border-base-300 bg-base-100 p-2 shadow-lg">
                <calendar-date
                  class="cally"
                  [attr.value]="formD.controls.fecha.value || null"
                  [attr.max]="hoy"
                  (change)="onFecha($event)"
                >
                  <svg aria-label="Mes anterior" class="size-4" slot="previous" viewBox="0 0 24 24">
                    <path fill="none" stroke="currentColor" stroke-width="2" d="M15 6l-6 6 6 6" />
                  </svg>
                  <svg aria-label="Mes siguiente" class="size-4" slot="next" viewBox="0 0 24 24">
                    <path fill="none" stroke="currentColor" stroke-width="2" d="M9 6l6 6-6 6" />
                  </svg>
                  <calendar-month></calendar-month>
                </calendar-date>
              </div>
            </div>
            <p class="text-xs text-base-content/50">
              Un administrador verificará el comprobante antes de asignar el flete.
            </p>
            <div class="modal-action">
              <button type="button" class="btn btn-ghost" (click)="cerrar()">Cancelar</button>
              <button class="btn btn-primary rounded-full" [disabled]="formD.invalid || enviando()">
                @if (enviando()) {
                  <span class="loading loading-spinner loading-sm"></span>
                }
                Enviar comprobante
              </button>
            </div>
          </form>
        }
      </div>
      <form method="dialog" class="modal-backdrop" (submit)="cerrar()">
        <button>close</button>
      </form>
    </dialog>
  `,
})
export class PagoSolicitudComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(PagoService);
  private readonly feedback = inject(UiFeedbackService);

  readonly solicitud = input.required<Solicitud>();
  readonly procesado = output<void>();

  protected readonly bancos = BANCOS_EC;
  protected readonly hoy = new Date().toISOString().slice(0, 10);
  protected readonly abierto = signal(false);

  private readonly calBtn = viewChild<ElementRef<HTMLButtonElement>>('calBtn');
  private readonly calPop = viewChild<ElementRef<HTMLElement>>('calPop');
  protected readonly metodo = signal<'tarjeta' | 'deposito'>('tarjeta');
  protected readonly enviando = signal(false);
  protected readonly numeroVista = signal('');
  protected readonly expVista = signal('');

  protected pago() {
    return pagoDe(this.solicitud());
  }

  protected readonly formT = this.fb.nonNullable.group({
    tipo: ['credito' as 'credito' | 'debito', [Validators.required]],
    numeroTarjeta: ['', [Validators.required, Validators.pattern(TARJETA)]],
    titular: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(80)]],
    expiracion: ['', [Validators.required, Validators.pattern(MMAA), noVencida]],
    cvv: ['', [Validators.required, Validators.pattern(/^\d{3,4}$/)]],
    marca: ['otra' as MarcaTarjeta],
  });

  protected readonly formD = this.fb.nonNullable.group({
    banco: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
    referencia: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(60)]],
    monto: [0, [Validators.required, Validators.min(0.01)]],
    fecha: ['', [Validators.required]],
  });

  protected readonly marcaEtiqueta = computed(
    () => MARCA_ETIQUETA[marcaDeTarjeta(this.numeroVista())],
  );

  constructor() {
    effect(() => {
      const t = this.solicitud().tarifaEstimada;
      if (!this.formD.controls.monto.dirty) this.formD.controls.monto.setValue(t);
    });
  }

  protected malo(c: AbstractControl): boolean {
    return c.invalid && (c.touched || c.dirty);
  }

  protected errorExp(): string {
    return this.formT.controls.expiracion.hasError('vencida')
      ? 'La tarjeta está vencida'
      : 'Formato MM/AA';
  }

  protected onNumero(ev: Event): void {
    const digits = (ev.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 19);
    this.numeroVista.set(enmascarar(digits));
    this.formT.controls.numeroTarjeta.setValue(digits);
    this.formT.controls.numeroTarjeta.markAsDirty();
    this.formT.controls.marca.setValue(marcaDeTarjeta(digits));
  }

  protected onExp(ev: Event): void {
    let d = (ev.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4);
    if (d.length >= 3) d = `${d.slice(0, 2)}/${d.slice(2)}`;
    this.expVista.set(d);
    this.formT.controls.expiracion.setValue(d);
    this.formT.controls.expiracion.markAsDirty();
  }

  protected onFecha(ev: Event): void {
    const valor = (ev.target as HTMLElement & { value?: string }).value ?? '';
    this.formD.controls.fecha.setValue(valor);
    this.formD.controls.fecha.markAsDirty();
    this.formD.controls.fecha.markAsTouched();
    this.cerrarCal();
  }

  protected alternarCal(): void {
    const pop = this.calPop()?.nativeElement as PopoverEl | undefined;
    const btn = this.calBtn()?.nativeElement;
    if (!pop || !btn) return;
    if (pop.matches(':popover-open')) {
      pop.hidePopover();
      return;
    }
    pop.showPopover();
    const r = btn.getBoundingClientRect();
    pop.style.left = `${r.left}px`;
    pop.style.minWidth = `${r.width}px`;
    const espacioAbajo = window.innerHeight - r.bottom;
    pop.style.top =
      espacioAbajo < pop.offsetHeight + 16
        ? `${Math.max(8, r.top - pop.offsetHeight - 6)}px`
        : `${r.bottom + 6}px`;
  }

  private cerrarCal(): void {
    const pop = this.calPop()?.nativeElement as PopoverEl | undefined;
    if (pop?.matches(':popover-open')) pop.hidePopover();
  }

  protected abrir(): void {
    this.metodo.set('tarjeta');
    this.cerrarCal();
    this.abierto.set(true);
  }

  protected cerrar(): void {
    this.abierto.set(false);
    this.cerrarCal();
  }

  protected pagarTarjeta(): void {
    if (this.formT.invalid) return;
    this.enviando.set(true);
    this.service.pagarPasarela(this.solicitud().id, this.formT.getRawValue()).subscribe({
      next: (r) => {
        this.enviando.set(false);
        this.cerrar();
        this.formT.reset({ tipo: 'credito', marca: 'otra' });
        this.numeroVista.set('');
        this.expVista.set('');
        if (r.aprobado) this.feedback.success('Pago confirmado');
        else this.feedback.error('El pago fue rechazado. Prueba con otra tarjeta o un depósito.');
        this.procesado.emit();
      },
      error: (err) => {
        this.enviando.set(false);
        this.feedback.error(apiMessage(err, 'No se pudo procesar el pago'));
      },
    });
  }

  protected registrarDeposito(): void {
    if (this.formD.invalid) return;
    this.enviando.set(true);
    this.service.registrarDeposito(this.solicitud().id, this.formD.getRawValue()).subscribe({
      next: () => {
        this.enviando.set(false);
        this.cerrar();
        this.feedback.success('Comprobante enviado. Queda en revisión.');
        this.procesado.emit();
      },
      error: (err) => {
        this.enviando.set(false);
        this.feedback.error(apiMessage(err, 'No se pudo registrar el depósito'));
      },
    });
  }
}

type PopoverEl = HTMLElement & { showPopover(): void; hidePopover(): void };

function noVencida(c: AbstractControl): { vencida: true } | null {
  const v = c.value as string;
  if (!v || !MMAA.test(v)) return null;
  return tarjetaVencida(v) ? { vencida: true } : null;
}
