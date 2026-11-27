export interface PlanoConfig {
  svg: string;
  json: string;
  programa: 'VF' | 'PV';
}

const SVG = 'https://res.cloudinary.com/kqee6exq/image/upload/q_auto/v1795744435/planovfypv.svg';
const JSON_URL = '/planos/villa-familia-prudencia-v.json';

const VILLA_FAMILIA: PlanoConfig = { svg: SVG, json: JSON_URL, programa: 'VF' };
const PRUDENCIA: PlanoConfig = { svg: SVG, json: JSON_URL, programa: 'PV' };

/** Configuración compartida por la vista interna y el enlace público del plano. */
export const PLANOS: Record<string, PlanoConfig> = {
  'VILLA FAMILIA': VILLA_FAMILIA,
  'PRUDENCIA ETAPA 5': PRUDENCIA,
  'PRUDENCIA V ETAPA': PRUDENCIA
};

export const PLANOS_POR_PROGRAMA: Record<string, PlanoConfig> = {
  VF: VILLA_FAMILIA,
  PV: PRUDENCIA
};

export const normalizarProyecto = (nombre: string): string =>
  (nombre || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\bRESIDENCIAL\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const planoParaProyecto = (nombre: string): PlanoConfig | null =>
  PLANOS[normalizarProyecto(nombre)] ?? null;
