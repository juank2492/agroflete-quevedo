import type { EstadoStock } from '@agroflete/shared';
import type { StockRecord } from '../ports/repositories.js';

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export function estadoStock(
  rec: Pick<StockRecord, 'cantidadActual' | 'umbralMinimo' | 'umbralMaximo'>,
): EstadoStock {
  if (rec.umbralMaximo > 0 && rec.cantidadActual > rec.umbralMaximo) return 'ALTO';
  if (rec.cantidadActual < rec.umbralMinimo) return 'BAJO';
  return 'OK';
}

export interface MovimientoStock {
  registro: StockRecord;
  /** Solo se emite al cambiar de estado. */
  evento: 'StockBajo' | 'StockAlto' | null;
}

export function aplicarMovimiento(actual: StockRecord, delta: number): MovimientoStock {
  const estadoAntes = estadoStock(actual);
  const registro: StockRecord = {
    ...actual,
    cantidadActual: round2(Math.max(0, actual.cantidadActual + delta)),
  };
  const estadoDespues = estadoStock(registro);

  let evento: MovimientoStock['evento'] = null;
  if (estadoDespues !== estadoAntes) {
    if (estadoDespues === 'BAJO') evento = 'StockBajo';
    else if (estadoDespues === 'ALTO') evento = 'StockAlto';
  }
  return { registro, evento };
}
