import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import type { Acopio, EstimacionTarifaResponse, Solicitud } from '@agroflete/shared';
import { SolicitudService } from '../core/solicitud.service';
import { TarifaService } from '../core/tarifa.service';
import { UiFeedbackService } from '../core/ui-feedback.service';
import { NuevaSolicitudComponent } from './nueva-solicitud.component';

const ACOPIO: Acopio = {
  id: 'acopio-centro',
  nombre: 'Centro de Acopio Quevedo Centro',
  lat: -1.0289,
  lon: -79.4646,
  zona: 'quevedo-centro',
};
const ESTIMACION: EstimacionTarifaResponse = {
  distanciaKm: 12.3,
  tarifa: 14.8,
  enTemporada: false,
};

describe('NuevaSolicitudComponent — confirmar en ≤ 3 toques', () => {
  let crearSpy: jasmine.Spy;
  let navigateSpy: jasmine.Spy;

  beforeEach(() => {
    // Geolocalización determinista: responde con éxito inmediato.
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (ok: PositionCallback) =>
          ok({ coords: { latitude: -1.05, longitude: -79.47 } } as GeolocationPosition),
      },
    });

    crearSpy = jasmine.createSpy('crear').and.returnValue(of({ id: 'sol-1' } as Solicitud));
    navigateSpy = jasmine.createSpy('navigate').and.resolveTo(true);

    TestBed.configureTestingModule({
      imports: [NuevaSolicitudComponent],
      providers: [
        {
          provide: TarifaService,
          useValue: { listarAcopios: () => of([ACOPIO]), estimar: () => of(ESTIMACION) },
        },
        { provide: SolicitudService, useValue: { crear: crearSpy } },
        { provide: UiFeedbackService, useValue: { success: () => {}, error: () => {} } },
        { provide: Router, useValue: { navigate: navigateSpy } },
      ],
    });
  });

  it('tras (cultivo, toneladas, confirmar) crea la solicitud una sola vez', () => {
    const fixture = TestBed.createComponent(NuevaSolicitudComponent);
    const cmp = fixture.componentInstance as unknown as {
      setCultivo: (c: string) => void;
      ajustarPeso: (d: number) => void;
      confirmar: () => void;
      form: { value: Record<string, unknown> };
    };
    fixture.detectChanges(); // ngOnInit: carga acopios + geolocalización + preselección

    // Toque 1
    cmp.setCultivo('banano');
    // Toque 2
    cmp.ajustarPeso(1);
    // Toque 3
    cmp.confirmar();

    expect(crearSpy).toHaveBeenCalledTimes(1);
    const payload = crearSpy.calls.mostRecent().args[0] as {
      acopioId: string;
      cultivo: string;
      pesoTon: number;
      origen: { lat: number; lon: number };
    };
    expect(payload.acopioId).toBe('acopio-centro'); // preseleccionado
    expect(payload.cultivo).toBe('banano');
    expect(payload.pesoTon).toBe(6); // 5 inicial + 1
    expect(payload.origen).toEqual({ lat: -1.05, lon: -79.47 });
    expect(navigateSpy).toHaveBeenCalledWith(['/p/solicitudes', 'sol-1']);
  });
});
