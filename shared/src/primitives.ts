import { z } from 'zod';

/** Límites aproximados del territorio continental de Ecuador. */
export const ECUADOR_BOUNDS = {
  latMin: -5.02,
  latMax: 1.5,
  lonMin: -81.1,
  lonMax: -75.1,
} as const;

export const latLonSchema = z.object({
  lat: z
    .number()
    .min(ECUADOR_BOUNDS.latMin, 'Latitud fuera de Ecuador')
    .max(ECUADOR_BOUNDS.latMax, 'Latitud fuera de Ecuador'),
  lon: z
    .number()
    .min(ECUADOR_BOUNDS.lonMin, 'Longitud fuera de Ecuador')
    .max(ECUADOR_BOUNDS.lonMax, 'Longitud fuera de Ecuador'),
});
export type LatLon = z.infer<typeof latLonSchema>;

/** Celular ecuatoriano: 09XXXXXXXX o +5939XXXXXXXX. */
export const telefonoRegex = /^(09\d{8}|\+5939\d{8})$/;
export const telefonoSchema = z
  .string()
  .regex(telefonoRegex, 'Teléfono inválido (formato 09XXXXXXXX o +5939XXXXXXXX)');

/** Placa de vehículo de carga: ABC-1234 o ABC1234. */
export const placaRegex = /^[A-Z]{3}-?\d{3,4}$/;
export const placaSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(placaRegex, 'Placa inválida (formato ABC-1234)');

export const emailSchema = z.string().trim().toLowerCase().email('Correo inválido');

export const passwordSchema = z
  .string()
  .min(8, 'Mínimo 8 caracteres')
  .regex(/[A-Z]/, 'Debe incluir una mayúscula')
  .regex(/\d/, 'Debe incluir un dígito');

export const idSchema = z.string().min(1);

export const isoDateSchema = z.string().datetime();

export const toneladasSchema = z
  .number()
  .positive('Debe ser mayor a 0')
  .max(40, 'Máximo 40 toneladas');

export const codigoConfirmacionSchema = z.string().regex(/^\d{6}$/, 'El código son 6 dígitos');
