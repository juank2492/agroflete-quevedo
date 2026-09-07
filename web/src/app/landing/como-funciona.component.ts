import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../core/icon.component';

@Component({
  selector: 'app-landing-como-funciona',
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="container-page py-16">
      <h1 class="text-3xl font-bold sm:text-4xl">Cómo funciona</h1>
      <p class="mt-3 max-w-2xl text-base-content/70">
        AgroFlete conecta a productores con transportistas de la zona de Quevedo a través de un
        único canal digital. Así se ve el proceso completo.
      </p>

      <ol class="mt-10 space-y-6">
        @for (item of pasos; track item.titulo; let i = $index) {
          <li class="rounded-box flex gap-4 border border-base-300 bg-base-100 p-6">
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-content"
            >
              {{ i + 1 }}
            </div>
            <div>
              <h2 class="text-lg font-semibold">{{ item.titulo }}</h2>
              <p class="mt-1 text-sm text-base-content/70">{{ item.detalle }}</p>
            </div>
          </li>
        }
      </ol>

      <div class="mt-10">
        <a routerLink="/auth/registro" class="btn btn-primary rounded-full">
          Empezar ahora <app-icon name="arrow" [size]="18" />
        </a>
      </div>
    </section>
  `,
})
export class ComoFuncionaComponent {
  protected readonly pasos = [
    {
      titulo: 'El productor publica la solicitud',
      detalle:
        'Desde el celular indica su ubicación, elige el centro de acopio de destino, el cultivo y las toneladas. El sistema calcula la distancia y muestra la tarifa estimada antes de confirmar.',
    },
    {
      titulo: 'La comercializadora asigna un camión',
      detalle:
        'La solicitud entra a una cola. El administrador ve los vehículos disponibles compatibles por zona y capacidad, y asigna el flete con un clic.',
    },
    {
      titulo: 'El transportista avanza los estados',
      detalle:
        'En camino, cargando, en ruta, entregado. Cada cambio queda en una línea de tiempo y dispara una notificación por correo al productor.',
    },
    {
      titulo: 'Alertas automáticas de demora',
      detalle:
        'Si una solicitud lleva más de 6 horas sin asignar, el sistema emite una alerta para que no se pierda la ventana de despacho.',
    },
  ];
}
