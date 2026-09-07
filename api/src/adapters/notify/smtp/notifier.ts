import nodemailer from 'nodemailer';
import type { Notifier } from '../../../core/ports/services.js';

export interface SmtpConfig {
  host: string;
  port: number;
  from: string;
  /** Usuario SMTP; ausente para Mailpit local. */
  user?: string;
  pass?: string;
  secure?: boolean;
}

/** Notificador SMTP para Mailpit local o proveedores autenticados. */
export function makeSmtpNotifier(cfg: SmtpConfig): Notifier {
  const auth = cfg.user && cfg.pass ? { user: cfg.user, pass: cfg.pass } : undefined;
  const secure = cfg.secure ?? cfg.port === 465;

  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure,
    auth,
    // Mailpit local no requiere TLS; los proveedores autenticados sí.
    ...(auth ? { requireTLS: !secure } : { tls: { rejectUnauthorized: false } }),
  });

  return {
    async enviarEmail({ to, subject, text }) {
      await transport.sendMail({ from: cfg.from, to, subject, text });
    },
  };
}
