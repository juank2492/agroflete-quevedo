import type { InventarioAcopio } from '@agroflete/shared';
import type { AppContext } from '../../app-context.js';
import { estadoStock } from '../../domain/inventario.js';

export async function obtenerInventario(ctx: AppContext): Promise<InventarioAcopio[]> {
  const [acopios, reglas] = await Promise.all([
    ctx.repos.acopios.listar(),
    ctx.repos.reglas.obtener(),
  ]);
  const nombreCultivo = new Map(reglas.cultivos.map((c) => [c.clave, c.nombre]));

  const tablero = await Promise.all(
    acopios.map(async (acopio) => {
      const filas = await ctx.repos.inventario.porAcopio(acopio.id);
      return {
        acopioId: acopio.id,
        acopioNombre: acopio.nombre,
        zona: acopio.zona,
        stock: filas
          .map((f) => ({
            cultivo: f.cultivo,
            cultivoNombre: nombreCultivo.get(f.cultivo) ?? f.cultivo,
            cantidadActual: f.cantidadActual,
            umbralMinimo: f.umbralMinimo,
            umbralMaximo: f.umbralMaximo,
            estado: estadoStock(f),
          }))
          .sort((a, b) => a.cultivoNombre.localeCompare(b.cultivoNombre)),
      };
    }),
  );
  return tablero;
}
