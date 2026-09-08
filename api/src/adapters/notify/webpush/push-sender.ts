import webpush from 'web-push';
import type { PushSender } from '../../../core/ports/services.js';

export interface WebPushOpts {
  publicKey: string;
  privateKey: string;
  subject: string;
}

/** Web Push deshabilitado cuando faltan las claves VAPID. */
export function makeWebPushSender(opts: WebPushOpts): PushSender {
  const habilitado = Boolean(opts.publicKey && opts.privateKey);
  if (habilitado) {
    webpush.setVapidDetails(opts.subject, opts.publicKey, opts.privateKey);
  }

  return {
    habilitado,

    clavePublica() {
      return habilitado ? opts.publicKey : null;
    },

    async enviar(sub, payload) {
      if (!habilitado) return 'error';
      try {
        await webpush.sendNotification(
          sub,
          JSON.stringify({
            notification: {
              title: payload.titulo,
              body: payload.cuerpo,
              icon: '/icons/logo-192.png',
              data: { url: payload.url ?? '/' },
            },
          }),
        );
        return 'ok';
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        // 404/410 indica una suscripción inexistente.
        return code === 404 || code === 410 ? 'expirada' : 'error';
      }
    },
  };
}
