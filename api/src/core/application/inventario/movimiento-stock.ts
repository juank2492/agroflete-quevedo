import type { AppContext } from '../../app-context.js';
import { NotFoundError, ValidationError } from '../../domain/errors.js';
import { aplicarMovimiento } from '../../domain/inventario.js';
import type { StockRecord } from '../../ports/repositories.js';

export interface ResultadoMovimiento {
  registro: StockRecord;
  evento: 'StockBajo' | 'StockAlto' | null;
}

/** Aplica un movimiento y emite alertas al cruzar un umbral. */
export async function registrarMovimientoStock(
  ctx: AppContext,
  args: { acopioId: string; cultivo: string; delta: number },
): Promise<ResultadoMovimiento> {
  const acopio = await ctx.repos.acopios.porId(args.acopioId);
  if (!acopio) throw new NotFoundError('El centro de acopio no existe');

  const reglas = await ctx.repos.reglas.obtener();
  const cultivo = reglas.cultivos.find((c) => c.clave === args.cultivo);
  if (!cultivo) throw new ValidationError(`El cultivo "${args.cultivo}" no está en el catálogo`);

  const actual: StockRecord = (await ctx.repos.inventario.obtener(args.acopioId, args.cultivo)) ?? {
    acopioId: args.acopioId,
    cultivo: args.cultivo,
    cantidadActual: 0,
    umbralMinimo: 0,
    umbralMaximo: 0,
  };

  const { registro, evento } = aplicarMovimiento(actual, args.delta);
  await ctx.repos.inventario.guardar(registro);

  if (evento) {
    await ctx.events.publish(evento, {
      acopioId: acopio.id,
      acopioNombre: acopio.nombre,
      cultivo: args.cultivo,
      cultivoNombre: cultivo.nombre,
      cantidadActual: registro.cantidadActual,
      umbral: evento === 'StockAlto' ? registro.umbralMaximo : registro.umbralMinimo,
    });
  }

  return { registro, evento };
}
