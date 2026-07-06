import rawCatalog from '@/data/bodegas-catalog.json';

export type BodegaProduct = {
  id: string;
  nombre: string;
  slug: string;
  varietal: string;
  varietal_slug: string;
  imagen_url: string;
  precio?: number;
  tamano?: string;
  caracteristicas?: string;
  habilitado: boolean;
  recomendado?: boolean;
};

export type BodegaCatalogItem = {
  id: string;
  nombre: string;
  slug: string;
  habilitada: boolean;
  logo_gold: string;
  logo_white: string;
  logo_clean: string;
  logo_original?: string;
  productos: BodegaProduct[];
};

export const bodegasCatalog = rawCatalog as BodegaCatalogItem[];

export const BODEGAS_STATUS_KEY = 'dolce-vino-bodegas-status-v1';
export const BODEGAS_EDITS_KEY = 'dolce-vino-bodegas-edits-v1';
export const BODEGAS_ADDED_KEY = 'dolce-vino-bodegas-added-v1';

export type BodegasStatus = {
  bodegas: Record<string, boolean>;
  productos: Record<string, boolean>;
};

export type BodegasEdits = {
  bodegas?: Record<string, Partial<Pick<BodegaCatalogItem, 'nombre' | 'logo_gold' | 'logo_white' | 'logo_clean'>>>;
  productos?: Record<string, Partial<Pick<BodegaProduct, 'nombre' | 'varietal' | 'tamano' | 'precio' | 'caracteristicas' | 'imagen_url' | 'recomendado'>>>;
  deletedProducts?: Record<string, boolean>;
};

export type BodegasAdded = BodegaCatalogItem[];

export function applyBodegasStatus(catalog: BodegaCatalogItem[], status?: BodegasStatus | null) {
  if (!status) return catalog;

  return catalog.map((bodega) => ({
    ...bodega,
    habilitada: status.bodegas[bodega.id] ?? bodega.habilitada,
    productos: bodega.productos.map((producto) => ({
      ...producto,
      habilitado: status.productos[producto.id] ?? producto.habilitado,
    })),
  }));
}

export function applyBodegasEdits(catalog: BodegaCatalogItem[], edits?: BodegasEdits | null) {
  if (!edits) return catalog;

  return catalog.map((bodega) => ({
    ...bodega,
    ...(edits.bodegas?.[bodega.id] || {}),
    productos: bodega.productos
      .filter((producto) => !edits.deletedProducts?.[producto.id])
      .map((producto) => ({
        ...producto,
        ...(edits.productos?.[producto.id] || {}),
      })),
  }));
}

export function getEnabledBodegas(catalog: BodegaCatalogItem[]) {
  return catalog
    .filter((bodega) => bodega.habilitada)
    .map((bodega) => ({
      ...bodega,
      productos: bodega.productos.filter((producto) => producto.habilitado),
    }))
    .filter((bodega) => bodega.productos.length > 0 || bodega.logo_gold || bodega.logo_white);
}


export function mergeAddedBodegas(catalog: BodegaCatalogItem[], added?: BodegasAdded | null) {
  const invalid = (name = '') => name.toLowerCase().includes('sol y vino');
  const cleanCatalog = catalog.filter((b) => !invalid(b.nombre));
  const cleanAdded = (added || []).filter((b) => !invalid(b.nombre));
  const byId = new Map<string, BodegaCatalogItem>();
  [...cleanCatalog, ...cleanAdded].forEach((b) => byId.set(b.id, b));
  return Array.from(byId.values());
}

export function slugifyText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' y ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}
