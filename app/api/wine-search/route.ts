import { NextResponse } from 'next/server';

const WINE_API_BASE_URL = process.env.WINE_API_BASE_URL || 'https://api.wineapi.io';
const WINE_API_KEY = process.env.WINE_API_KEY;

type WineApiItem = Record<string, unknown>;

function pickString(item: WineApiItem, keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
}

function normalizeWine(item: WineApiItem) {
  const wineryValue = item.winery;
  const winery = typeof wineryValue === 'string'
    ? wineryValue
    : wineryValue && typeof wineryValue === 'object' && 'name' in wineryValue && typeof (wineryValue as { name?: unknown }).name === 'string'
      ? (wineryValue as { name: string }).name
      : '';

  const grapesValue = item.grapes || item.varietals || item.grape_varieties;
  const grapes = Array.isArray(grapesValue)
    ? grapesValue.map(g => typeof g === 'string' ? g : (g && typeof g === 'object' && 'name' in g ? String((g as { name?: unknown }).name || '') : '')).filter(Boolean).join(', ')
    : typeof grapesValue === 'string'
      ? grapesValue
      : '';

  const image = pickString(item, ['image', 'image_url', 'label_url', 'thumbnail', 'photo']);

  return {
    id: String(item.id || item.wine_id || item.slug || item.name || crypto.randomUUID()),
    nombre: pickString(item, ['name', 'title', 'wine_name']) || 'Vino sin nombre',
    bodega: winery || pickString(item, ['producer', 'brand', 'bodega']) || 'Bodega no especificada',
    varietal: grapes || pickString(item, ['varietal', 'grape', 'type']) || 'Varietal no especificado',
    region: pickString(item, ['region', 'country', 'appellation']),
    imagen: image,
    descripcion: pickString(item, ['description', 'notes', 'tasting_notes'])
  };
}

export async function GET(request: Request) {
  if (!WINE_API_KEY) {
    return NextResponse.json({ error: 'Falta configurar WINE_API_KEY en variables de entorno.' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  if (!q) return NextResponse.json({ results: [] });

  const url = `${WINE_API_BASE_URL.replace(/\/$/, '')}/wines/search?q=${encodeURIComponent(q)}`;

  try {
    const response = await fetch(url, {
      headers: { 'X-API-Key': WINE_API_KEY, 'Accept': 'application/json' },
      next: { revalidate: 3600 }
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json({ error: 'No se pudo consultar WineAPI.', detail: data }, { status: response.status });
    }

    const rawResults = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : Array.isArray(data?.wines) ? data.wines : [];
    return NextResponse.json({ results: rawResults.map(normalizeWine).slice(0, 12) });
  } catch (error) {
    return NextResponse.json({ error: 'Error de conexión con WineAPI.' }, { status: 500 });
  }
}
