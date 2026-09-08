import { z } from 'zod';
import { isoDateSchema } from '../primitives.js';

export const CATEGORIAS_NOTIF = ['solicitud', 'flete', 'pago', 'incidencia', 'sistema'] as const;
export const categoriaNotifSchema = z.enum(CATEGORIAS_NOTIF);
export type CategoriaNotif = z.infer<typeof categoriaNotifSchema>;

/** Notificación mostrada dentro de la aplicación. */
export const notificacionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  categoria: categoriaNotifSchema,
  titulo: z.string(),
  cuerpo: z.string(),
  /** Enlace interno opcional. */
  enlace: z.string().optional(),
  createdAt: isoDateSchema,
  leidoEn: isoDateSchema.optional(),
});
export type Notificacion = z.infer<typeof notificacionSchema>;

export const listarNotificacionesResponseSchema = z.array(notificacionSchema);

/** Suscripción Web Push serializada. */
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});
export type PushSubscriptionDTO = z.infer<typeof pushSubscriptionSchema>;

export const quitarPushRequestSchema = z.object({ endpoint: z.string().url() });
