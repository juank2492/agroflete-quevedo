import type { AjustarStockRequest, StockCultivo } from '@agroflete/shared';
import type { AppContext } from '../../app-context.js';
import { ValidationError } from '../../domain/errors.js';
import { estadoStock } from '../../domain/inventario.js';
import { registrarMovimientoStock } from './movimiento-stock.js';

export async function ajustarStock(
  ctx: AppContext,
  acopioId: string,
  cultivo: string,
  input: AjustarStockRequest,
  actorId: string,
): Promise<StockCultivo> {
  const reglas = await ctx.repos.reglas.obtener();
  const cat = reglas.cultivos.find((c) => c.clave === cultivo);
  if (!cat) throw new ValidationError(`El cultivo "${cultivo}" no está en el catálogo`);

  const { registro } = await registrarMovimientoStock(ctx, {
    acopioId,
    cultivo,
    delta: input.delta,
  });

  ctx.logger.info(
    { acopioId, cultivo, delta: input.delta, motivo: input.motivo, actorId },
    'ajuste manual de stock',
  );

  return {
    cultivo,
    cultivoNombre: cat.nombre,
    cantidadActual: registro.cantidadActual,
    umbralMinimo: registro.umbralMinimo,
    umbralMaximo: registro.umbralMaximo,
    estado: estadoStock(registro),
  };
}
