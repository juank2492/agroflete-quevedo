import type { FijarUmbralesRequest, StockCultivo } from '@agroflete/shared';
import type { AppContext } from '../../app-context.js';
import { NotFoundError, ValidationError } from '../../domain/errors.js';
import { estadoStock } from '../../domain/inventario.js';
import type { StockRecord } from '../../ports/repositories.js';

export async function fijarUmbrales(
  ctx: AppContext,
  acopioId: string,
  cultivo: string,
  input: FijarUmbralesRequest,
): Promise<StockCultivo> {
  const acopio = await ctx.repos.acopios.porId(acopioId);
  if (!acopio) throw new NotFoundError('El centro de acopio no existe');

  const reglas = await ctx.repos.reglas.obtener();
  const cat = reglas.cultivos.find((c) => c.clave === cultivo);
  if (!cat) throw new ValidationError(`El cultivo "${cultivo}" no está en el catálogo`);

  const previo = await ctx.repos.inventario.obtener(acopioId, cultivo);
  const registro: StockRecord = {
    acopioId,
    cultivo,
    cantidadActual: previo?.cantidadActual ?? 0,
    umbralMinimo: input.umbralMinimo,
    umbralMaximo: input.umbralMaximo,
  };
  await ctx.repos.inventario.guardar(registro);

  return {
    cultivo,
    cultivoNombre: cat.nombre,
    cantidadActual: registro.cantidadActual,
    umbralMinimo: registro.umbralMinimo,
    umbralMaximo: registro.umbralMaximo,
    estado: estadoStock(registro),
  };
}
