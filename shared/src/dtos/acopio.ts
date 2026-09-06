import { z } from 'zod';
import { zonaSchema } from '../domain.js';

export const acopioSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  lat: z.number(),
  lon: z.number(),
  zona: zonaSchema,
});
export type Acopio = z.infer<typeof acopioSchema>;
