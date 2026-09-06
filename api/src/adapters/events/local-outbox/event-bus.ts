import { eventPayloadSchemas } from '@agroflete/shared';
import type { Clock, EventBus, IdGenerator } from '../../../core/ports/services.js';
import type { OutboxRepository } from '../../../core/ports/repositories.js';

/**
 * EventBus local: valida el payload y lo escribe en el outbox de la tabla.
 * El worker (polling) lo entrega a los suscriptores. En AWS este adaptador
 * publicará a EventBridge en su lugar.
 */
export function makeOutboxEventBus(deps: {
  outbox: OutboxRepository;
  ids: IdGenerator;
  clock: Clock;
}): EventBus {
  return {
    async publish(tipo, payload) {
      const schema = eventPayloadSchemas[tipo];
      const parsed = schema.parse(payload);
      await deps.outbox.agregar({
        id: deps.ids.ulid(),
        tipo,
        payload: parsed,
        createdAt: deps.clock.nowIso(),
      });
    },
  };
}
