import { TestBed } from '@angular/core/testing';
import { EstadoBadgeComponent } from './estado-badge.component';

describe('EstadoBadgeComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [EstadoBadgeComponent] }));

  function render(estado: string): HTMLElement {
    const fixture = TestBed.createComponent(EstadoBadgeComponent);
    fixture.componentRef.setInput('estado', estado);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('mapea estados de solicitud, flete y vehículo a etiqueta y clase', () => {
    expect(render('PENDIENTE').textContent?.trim()).toBe('Pendiente');
    expect(render('ENTREGADO').querySelector('span')?.className).toContain('badge-success');
    expect(render('DISPONIBLE').textContent?.trim()).toBe('Disponible');
    expect(render('EN_CAMINO_ORIGEN').textContent?.trim()).toBe('En camino al origen');
  });

  it('para un estado desconocido muestra el valor crudo', () => {
    expect(render('LO_QUE_SEA').textContent?.trim()).toBe('LO_QUE_SEA');
  });
});
