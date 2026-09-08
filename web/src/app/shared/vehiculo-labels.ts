import type { TipoVehiculo } from '@agroflete/shared';

const TIPO: Record<TipoVehiculo, string> = {
  furgon: 'Furgón',
  camion: 'Camión',
  plataforma: 'Plataforma',
  'camion-tolva': 'Camión tolva',
};

export function tipoVehiculoLabel(tipo: string): string {
  return TIPO[tipo as TipoVehiculo] ?? tipo;
}
