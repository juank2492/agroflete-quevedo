import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  effect,
  input,
  signal,
  viewChild,
} from '@angular/core';
import {
  GEOCERCA_ACOPIO_M,
  rumboGrados,
  type LatLon,
  type UbicacionFlete,
} from '@agroflete/shared';
import type * as L from 'leaflet';

const COLOR_ORIGEN = '#64748b';
const COLOR_DESTINO = '#2f9e5e';
const COLOR_RUTA = '#1f7a45';
const COLOR_CAMION = '#0f2417';

const CAMION_PATH =
  'M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z';

/**
 * Los estilos van en línea: Leaflet inserta este HTML fuera de la plantilla,
 * donde las clases con encapsulación de Angular no aplican.
 */
function iconoCamionHtml(rumbo: number | null): string {
  const haciaOeste = rumbo !== null && rumbo > 180;
  const flip = haciaOeste ? 'transform:scaleX(-1);' : '';
  return (
    `<div style="display:grid;place-items:center;box-sizing:border-box;` +
    `width:30px;height:30px;border-radius:999px;background:${COLOR_CAMION};` +
    `border:2.5px solid #fff;box-shadow:0 2px 6px rgb(15 36 23 / 0.4)">` +
    `<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"` +
    ` style="${flip}display:block">` +
    `<path fill="#fff" d="${CAMION_PATH}"/></svg></div>`
  );
}

/** Mapa de seguimiento con ruta, rastro y geocerca de entrega. */
@Component({
  selector: 'app-mapa-flete',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative h-64 w-full overflow-hidden rounded-box border border-base-300">
      <div #cont class="absolute inset-0 z-0"></div>
      @if (!listo()) {
        <div
          class="absolute inset-0 z-10 grid place-items-center bg-base-200 text-sm text-base-content/50"
        >
          Cargando mapa…
        </div>
      }
    </div>
  `,
})
export class MapaFleteComponent implements OnDestroy {
  readonly origen = input<LatLon | null>(null);
  readonly destino = input<LatLon | null>(null);
  readonly ultima = input<UbicacionFlete | null>(null);
  readonly ruta = input<UbicacionFlete[]>([]);
  /** Ruta vial; si está vacía se usa la recta de respaldo. */
  readonly rutaVial = input<LatLon[]>([]);

  private readonly cont = viewChild.required<ElementRef<HTMLDivElement>>('cont');
  protected readonly listo = signal(false);

  private L!: typeof L;
  private map: L.Map | null = null;
  private capa: L.LayerGroup | null = null;

  constructor() {
    afterNextRender(() => void this.crear());
    effect(() => {
      this.origen();
      this.destino();
      this.ultima();
      this.ruta();
      this.rutaVial();
      if (this.listo()) this.pintar();
    });
  }

  private async crear(): Promise<void> {
    this.L = await import('leaflet');
    const o = this.origen() ?? this.destino() ?? { lat: -1.03, lon: -79.46 };

    this.map = this.L.map(this.cont().nativeElement, { attributionControl: true }).setView(
      [o.lat, o.lon],
      11,
    );
    this.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap',
    }).addTo(this.map);
    this.capa = this.L.layerGroup().addTo(this.map);

    this.listo.set(true);
    setTimeout(() => this.map?.invalidateSize(), 0);
    this.pintar();
  }

  private circulo(color: string, p: LatLon, texto: string): L.CircleMarker {
    const m = this.L.circleMarker([p.lat, p.lon], {
      radius: 8,
      weight: 2,
      color: '#ffffff',
      fillColor: color,
      fillOpacity: 1,
    });
    m.bindTooltip(texto);
    return m;
  }

  private rumbo(pos: LatLon): number | null {
    const r = this.ruta();
    if (r.length >= 2) {
      const a = r[r.length - 2]!;
      const b = r[r.length - 1]!;
      if (a.lat !== b.lat || a.lon !== b.lon) return rumboGrados(a, b);
    }
    const o = this.origen();
    if (o && (o.lat !== pos.lat || o.lon !== pos.lon)) return rumboGrados(o, pos);
    return null;
  }

  private pintar(): void {
    if (!this.map || !this.capa) return;
    this.capa.clearLayers();

    const o = this.origen();
    const d = this.destino();
    const vial = this.rutaVial();
    const rastro = this.ruta();
    const camion = this.ultima() ?? (rastro.length ? rastro[rastro.length - 1]! : null);
    const pts: L.LatLngExpression[] = [];
    const push = (p: LatLon) => pts.push([p.lat, p.lon]);

    // Ruta por carretera, o recta punteada de respaldo.
    if (vial.length >= 2) {
      this.L.polyline(
        vial.map((p) => [p.lat, p.lon] as L.LatLngExpression),
        { color: COLOR_RUTA, weight: 5, opacity: 0.85, lineCap: 'round' },
      ).addTo(this.capa);
      vial.forEach(push);
    } else if (o && d) {
      this.L.polyline(
        [
          [o.lat, o.lon],
          [d.lat, d.lon],
        ],
        { color: COLOR_RUTA, weight: 3, opacity: 0.5, dashArray: '6 8' },
      ).addTo(this.capa);
    }

    // Rastro ya recorrido.
    if (rastro.length >= 2) {
      this.L.polyline(
        rastro.map((p) => [p.lat, p.lon] as L.LatLngExpression),
        { color: COLOR_ORIGEN, weight: 3, opacity: 0.7, dashArray: '1 6' },
      ).addTo(this.capa);
      rastro.forEach(push);
    }

    if (o) {
      this.circulo(COLOR_ORIGEN, o, 'Origen · recogida').addTo(this.capa);
      push(o);
    }
    if (d) {
      this.L.circle([d.lat, d.lon], {
        radius: GEOCERCA_ACOPIO_M,
        color: COLOR_DESTINO,
        weight: 1,
        fillColor: COLOR_DESTINO,
        fillOpacity: 0.08,
      }).addTo(this.capa);
      this.circulo(COLOR_DESTINO, d, 'Destino · acopio').addTo(this.capa);
      push(d);
    }
    if (camion) {
      this.L.marker([camion.lat, camion.lon], {
        icon: this.L.divIcon({
          className: '',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          html: iconoCamionHtml(this.rumbo(camion)),
        }),
        zIndexOffset: 1000,
      })
        .bindTooltip('Transportista')
        .addTo(this.capa);
      push(camion);
    }

    if (pts.length === 1) this.map.setView(pts[0]!, 13);
    else if (pts.length > 1) this.map.fitBounds(this.L.latLngBounds(pts).pad(0.2), { maxZoom: 15 });
  }

  ngOnDestroy(): void {
    this.map?.remove();
    this.map = null;
  }
}
