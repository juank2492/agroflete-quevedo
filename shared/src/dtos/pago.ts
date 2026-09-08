import { z } from 'zod';
import { isoDateSchema } from '../primitives.js';

/** Pago independiente del estado de la solicitud; en este proyecto es simulado. */
export const ESTADOS_PAGO = ['PENDIENTE', 'EN_REVISION', 'PAGADO', 'RECHAZADO'] as const;
export const estadoPagoSchema = z.enum(ESTADOS_PAGO);
export type EstadoPago = z.infer<typeof estadoPagoSchema>;

export const METODOS_PAGO = ['PASARELA', 'DEPOSITO'] as const;
export const metodoPagoSchema = z.enum(METODOS_PAGO);
export type MetodoPago = z.infer<typeof metodoPagoSchema>;

export const comprobanteDepositoSchema = z.object({
  banco: z.string().trim().min(2, 'Indica el banco').max(60),
  referencia: z.string().trim().min(3, 'Nº de comprobante muy corto').max(60),
  monto: z.number().positive('Monto inválido'),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha en formato AAAA-MM-DD'),
});
export type ComprobanteDeposito = z.infer<typeof comprobanteDepositoSchema>;

export const pagoSolicitudSchema = z.object({
  estado: estadoPagoSchema,
  metodo: metodoPagoSchema.optional(),
  monto: z.number().optional(),
  referencia: z.string().optional(),
  actualizadoEn: isoDateSchema,
  comprobante: comprobanteDepositoSchema.optional(),
  nota: z.string().optional(),
});
export type PagoSolicitud = z.infer<typeof pagoSolicitudSchema>;

export const TIPOS_TARJETA = ['credito', 'debito'] as const;
export const tipoTarjetaSchema = z.enum(TIPOS_TARJETA);
export type TipoTarjeta = z.infer<typeof tipoTarjetaSchema>;

export const MARCAS_TARJETA = ['visa', 'mastercard', 'otra'] as const;
export const marcaTarjetaSchema = z.enum(MARCAS_TARJETA);
export type MarcaTarjeta = z.infer<typeof marcaTarjetaSchema>;

export const pagarPasarelaRequestSchema = z.object({
  numeroTarjeta: z
    .string()
    .trim()
    .transform((s) => s.replace(/[\s-]+/g, ''))
    .pipe(z.string().regex(/^\d{13,19}$/, 'Número de tarjeta inválido')),
  titular: z.string().trim().min(3, 'Nombre del titular').max(80),
  expiracion: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, 'Vencimiento MM/AA'),
  cvv: z.string().regex(/^\d{3,4}$/, 'CVV de 3 o 4 dígitos'),
  tipo: tipoTarjetaSchema,
  marca: marcaTarjetaSchema.default('otra'),
});
export type PagarPasarelaRequest = z.infer<typeof pagarPasarelaRequestSchema>;

export function marcaDeTarjeta(numero: string): MarcaTarjeta {
  const n = numero.replace(/\D/g, '');
  if (/^4/.test(n)) return 'visa';
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(n)) return 'mastercard';
  return 'otra';
}

export function tarjetaVencida(expiracion: string, ahora: Date = new Date()): boolean {
  const m = /^(\d{2})\/(\d{2})$/.exec(expiracion);
  if (!m) return true;
  const mes = Number(m[1]);
  const anio = 2000 + Number(m[2]);
  // El vencimiento se evalúa al final del mes.
  const finDeMes = new Date(anio, mes, 0, 23, 59, 59);
  return finDeMes.getTime() < ahora.getTime();
}

export const registrarDepositoRequestSchema = comprobanteDepositoSchema;
export type RegistrarDepositoRequest = z.infer<typeof registrarDepositoRequestSchema>;

export const revisarPagoRequestSchema = z.object({
  aprobar: z.boolean(),
  nota: z.string().trim().max(300).optional(),
});
export type RevisarPagoRequest = z.infer<typeof revisarPagoRequestSchema>;

export const resultadoPagoSchema = z.object({
  pago: pagoSolicitudSchema,
  aprobado: z.boolean(),
});
export type ResultadoPago = z.infer<typeof resultadoPagoSchema>;
