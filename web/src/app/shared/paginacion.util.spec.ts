import { paginar, totalPaginas } from './paginacion.component';

describe('paginacion util', () => {
  const datos = Array.from({ length: 23 }, (_, i) => i + 1);

  it('totalPaginas redondea hacia arriba y nunca baja de 1', () => {
    expect(totalPaginas(23, 10)).toBe(3);
    expect(totalPaginas(20, 10)).toBe(2);
    expect(totalPaginas(0, 10)).toBe(1);
  });

  it('paginar devuelve la porción correcta (1-based)', () => {
    expect(paginar(datos, 1, 10)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(paginar(datos, 3, 10)).toEqual([21, 22, 23]);
  });

  it('paginar tolera páginas fuera de rango', () => {
    expect(paginar(datos, 0, 10)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(paginar(datos, 9, 10)).toEqual([]);
  });
});
