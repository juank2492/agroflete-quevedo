import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../core/icon.component';
import { RevealDirective } from '../core/reveal.directive';
import { StatComponent } from './stat.component';

interface Paso {
  icon: string;
  titulo: string;
  detalle: string;
}
interface Beneficio {
  icon: string;
  titulo: string;
  detalle: string;
}

@Component({
  selector: 'app-landing-home',
  imports: [RouterLink, IconComponent, RevealDirective, StatComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- HERO -->
    <section class="relative overflow-hidden">
      <div
        class="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-lima/30 blur-3xl"
        aria-hidden="true"
      ></div>
      <div class="container-page grid items-center gap-12 py-16 lg:grid-cols-2 lg:py-24">
        <div>
          <span class="badge badge-lg border-primary/30 bg-primary/10 text-primary">
            Plataforma serverless · Quevedo
          </span>
          <h1 class="mt-4 text-4xl font-bold leading-tight sm:text-5xl">
            Tus cosechas salen a tiempo, con una
            <span class="text-primary">tarifa clara</span>.
          </h1>
          <p class="mt-4 max-w-lg text-lg text-base-content/70">
            Publica la carga de maíz o banano, recibe al instante el precio del flete calculado por
            kilómetros y sigue el viaje hasta el centro de acopio. Sin intermediarios, sin llamadas.
          </p>
          <div class="mt-8 flex flex-wrap gap-3">
            <a routerLink="/auth/registro" class="btn btn-primary btn-lg rounded-full">
              Crear cuenta <app-icon name="arrow" [size]="18" />
            </a>
            <a routerLink="/como-funciona" class="btn btn-ghost btn-lg rounded-full">
              Cómo funciona
            </a>
          </div>
          <p class="mt-4 flex items-center gap-2 text-sm text-base-content/60">
            <app-icon name="check" [size]="16" /> Para productores y transportistas de la zona
          </p>
        </div>

        <div appReveal class="relative">
          <div class="rounded-box border border-base-300 bg-base-100 p-6 shadow-card">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-base-content/60">Tarifa estimada</span>
              <span class="badge badge-success badge-sm">en vivo</span>
            </div>
            <div class="mt-2 font-display text-4xl font-bold">$ 42.80</div>
            <div class="mt-4 space-y-3 text-sm">
              <div class="flex items-center gap-3">
                <app-icon name="pin" [size]="18" class="text-primary" />
                <span>Finca km 12 vía Valencia</span>
              </div>
              <div class="ml-2 border-l-2 border-dashed border-base-300 pl-5 text-base-content/60">
                34.6 km · maíz · 8 t
              </div>
              <div class="flex items-center gap-3">
                <app-icon name="pin" [size]="18" class="text-secondary" />
                <span>Centro de acopio Quevedo Centro</span>
              </div>
            </div>
            <button class="btn btn-primary btn-block mt-6 rounded-full">Confirmar flete</button>
            <p class="mt-2 text-center text-xs text-base-content/50">3 toques para publicar</p>
          </div>
        </div>
      </div>
    </section>

    <!-- CÓMO FUNCIONA -->
    <section appReveal class="bg-base-100 py-16">
      <div class="container-page">
        <h2 class="text-center text-3xl font-bold">Tres pasos, un canal</h2>
        <p class="mx-auto mt-2 max-w-xl text-center text-base-content/70">
          Reemplaza los acuerdos por teléfono con un flujo claro y trazable.
        </p>
        <div class="mt-10 grid gap-6 md:grid-cols-3">
          @for (p of pasos; track p.titulo; let i = $index) {
            <div class="rounded-box border border-base-300 bg-base-200/50 p-6">
              <div
                class="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"
              >
                <app-icon [name]="p.icon" />
              </div>
              <div class="mt-4 text-sm font-semibold text-primary">Paso {{ i + 1 }}</div>
              <h3 class="mt-1 text-lg font-semibold">{{ p.titulo }}</h3>
              <p class="mt-1 text-sm text-base-content/70">{{ p.detalle }}</p>
            </div>
          }
        </div>
      </div>
    </section>

    <!-- BENEFICIOS -->
    <section appReveal class="py-16">
      <div class="container-page">
        <h2 class="text-3xl font-bold">Por qué usarlo</h2>
        <div class="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          @for (b of beneficios; track b.titulo) {
            <div class="rounded-box bg-base-100 p-6 shadow-card">
              <app-icon [name]="b.icon" [size]="24" class="text-primary" />
              <h3 class="mt-3 font-semibold">{{ b.titulo }}</h3>
              <p class="mt-1 text-sm text-base-content/70">{{ b.detalle }}</p>
            </div>
          }
        </div>
      </div>
    </section>

    <!-- ESTADÍSTICAS (diagnóstico del estudio) -->
    <section appReveal class="bg-primary py-16 text-primary-content">
      <div class="container-page">
        <h2 class="text-center text-2xl font-semibold">El problema que resolvemos</h2>
        <p class="mx-auto mt-2 max-w-2xl text-center text-primary-content/80">
          Datos del diagnóstico a productores y transportistas de Quevedo.
        </p>
        <div class="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <app-stat
            [valor]="72.5"
            [decimales]="1"
            sufijo="%"
            etiqueta="coordinaba el flete de forma informal"
          />
          <app-stat
            [valor]="12"
            prefijo="hasta "
            sufijo=" h"
            etiqueta="de espera para evacuar la cosecha"
          />
          <app-stat [valor]="25" sufijo="%" etiqueta="del margen se lo llevaba la intermediación" />
          <app-stat [valor]="0" prefijo="$" etiqueta="costo de infraestructura en inactividad" />
        </div>
      </div>
    </section>

    <!-- TESTIMONIO -->
    <section appReveal class="py-16">
      <div class="container-page">
        <figure class="rounded-box mx-auto max-w-3xl bg-base-100 p-8 text-center shadow-card">
          <app-icon name="leaf" [size]="28" class="mx-auto text-primary" />
          <blockquote class="mt-4 text-lg italic text-base-content/80">
            “Antes coordinábamos los camiones a punta de llamadas y regateo. Con un canal
            centralizado el productor sabe cuánto va a pagar y cuándo sale su carga.”
          </blockquote>
          <figcaption class="mt-4 text-sm font-medium text-base-content/60">
            Comercializadora Agropecuaria Local — Quevedo
          </figcaption>
        </figure>
      </div>
    </section>

    <!-- CTA -->
    <section class="bg-base-100 py-16">
      <div class="container-page">
        <div
          class="rounded-box flex flex-col items-center gap-4 bg-gradient-to-br from-primary to-secondary p-10 text-center text-primary-content"
        >
          <h2 class="text-2xl font-bold sm:text-3xl">Publica tu primer flete hoy</h2>
          <p class="max-w-xl text-primary-content/80">
            Regístrate como productor o transportista y empieza a coordinar sin intermediarios.
          </p>
          <a routerLink="/auth/registro" class="btn btn-lg rounded-full bg-base-100 text-primary">
            Crear cuenta gratis <app-icon name="arrow" [size]="18" />
          </a>
        </div>
      </div>
    </section>
  `,
})
export class HomeComponent {
  protected readonly pasos: Paso[] = [
    {
      icon: 'leaf',
      titulo: 'Publica la carga',
      detalle: 'Ubicación, centro de acopio, cultivo y toneladas. La tarifa se calcula sola.',
    },
    {
      icon: 'truck',
      titulo: 'Asignación del camión',
      detalle: 'La comercializadora empareja tu solicitud con un transportista compatible.',
    },
    {
      icon: 'route',
      titulo: 'Seguimiento del viaje',
      detalle: 'Estados del flete y alertas por correo hasta la entrega en acopio.',
    },
  ];

  protected readonly beneficios: Beneficio[] = [
    {
      icon: 'chart',
      titulo: 'Tarifa transparente',
      detalle: 'Cálculo automático por kilómetros y tipo de carga, sin regateo.',
    },
    {
      icon: 'clock',
      titulo: 'Menos tiempo muerto',
      detalle: 'Alertas por evento cuando una carga lleva demasiado sin asignar.',
    },
    {
      icon: 'shield',
      titulo: 'Módulos independientes',
      detalle: 'Si falla una parte, el portal y el resto de funciones siguen operando.',
    },
    {
      icon: 'bolt',
      titulo: 'Costo bajo',
      detalle: 'Arquitectura serverless: se paga por uso, cero costo en inactividad.',
    },
  ];
}
