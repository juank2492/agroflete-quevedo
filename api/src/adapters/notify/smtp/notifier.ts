import nodemailer from 'nodemailer';
import type { Notifier } from '../../../core/ports/services.js';

export interface SmtpConfig {
  host: string;
  port: number;
  from: string;
  /** Usuario SMTP. Ausente => sin autenticación (Mailpit local). */
  user?: string;
  /** Contraseña / app password. */
  pass?: string;
  /** TLS implícito (puerto 465). Por defecto se deduce del puerto. */
  secure?: boolean;
}

/**
 * Notifier por SMTP. Sirve tanto para Mailpit local (sin auth) como para un
 * proveedor real (Gmail, SES, Brevo...) cuando se dan user/pass. En AWS se
 * sustituye por SES.
 */
export function makeSmtpNotifier(cfg: SmtpConfig): Notifier {
  const auth = cfg.user && cfg.pass ? { user: cfg.user, pass: cfg.pass } : undefined;
  const secure = cfg.secure ?? cfg.port === 465;

  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure,
    auth,
    // Con auth (proveedor real) exigimos STARTTLS y validación normal de cert.
    // Sin auth (Mailpit en 127.0.0.1) no hay certificado que validar.
    ...(auth ? { requireTLS: !secure } : { tls: { rejectUnauthorized: false } }),
  });

  return {
    async enviarEmail({ to, subject, text }) {
      await transport.sendMail({ from: cfg.from, to, subject, text });
    },
  };
}
