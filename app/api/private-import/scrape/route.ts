import { NextRequest, NextResponse } from 'next/server';

const VARIETALS = [
  'Malbec', 'Cabernet Sauvignon', 'Cabernet Franc', 'Merlot', 'Pinot Noir', 'Syrah',
  'Bonarda', 'Petit Verdot', 'Tannat', 'Tempranillo', 'Blend', 'Chardonnay',
  'Sauvignon Blanc', 'Torrontés', 'Torrontes', 'Viognier', 'Semillon', 'Riesling',
  'Chenin', 'Rosé', 'Rose', 'Espumante', 'Brut', 'Extra Brut', 'Brut Nature',
  'Gin', 'Whisky', 'Vodka', 'Ron', 'Aperitivo', 'Vermut', 'Vermouth'
];

type ImportedProduct = {
  nombre: string;
  bodega: string;
  categoria: string;
  varietal: string;
  tipo: string;
  notas: string;
  caracteristicas: Record<string, string>;
  imagen_original_url: string;
  publicado: boolean;
};

function decodeHtml(value = '') {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&ntilde;/g, 'ñ')
    .replace(/&Ntilde;/g, 'Ñ')
    .replace(/&aacute;/g, 'á')
    .replace(/&eacute;/g, 'é')
    .replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó')
    .replace(/&uacute;/g, 'ú')
    .replace(/&Aacute;/g, 'Á')
    .replace(/&Eacute;/g, 'É')
    .replace(/&Iacute;/g, 'Í')
    .replace(/&Oacute;/g, 'Ó')
    .replace(/&Uacute;/g, 'Ú')
    .replace(/&nbsp;/g, ' ');
}

function cleanText(value = '') {
  return decodeHtml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function attr(tag: string, name: string) {
  const reg = new RegExp(`${name}=["']([^"']+)["']`, 'i');
  const match = tag.match(reg);
  return match ? decodeHtml(match[1]) : '';
}

function absoluteUrl(url: string, base: string) {
  if (!url) return '';
  try { return new URL(url, base).href; } catch { return ''; }
}

function findMeta(html: string, property: string) {
  const reg = new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
  const match = html.match(reg);
  return match ? decodeHtml(match[1]) : '';
}

function detectVarietal(text: string) {
  const found = VARIETALS.find(v => new RegExp(`\\b${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text));
  if (!found) return '';
  if (/torrontes/i.test(found)) return 'Torrontés';
  if (/rose/i.test(found)) return 'Rosé';
  return found;
}

function detectCategory(text: string) {
  if (/espumante|champagne|brut/i.test(text)) return 'Espumantes';
  if (/gin|whisky|vodka|ron|aperitivo|vermut|vermouth|destilado/i.test(text)) return 'Destilados';
  if (/aceite|chocolate|conserva|delicatessen|gourmet|pasta|salsa/i.test(text)) return 'Delicatessen';
  return 'Vinos';
}

function detectType(text: string) {
  if (/blanco|chardonnay|sauvignon|torront|viognier|semillon|riesling|chenin/i.test(text)) return 'Blanco';
  if (/rosado|rosé|rose/i.test(text)) return 'Rosado';
  if (/espumante|brut|champagne/i.test(text)) return 'Espumante';
  if (/gin|whisky|vodka|ron|vermut|vermouth|destilado/i.test(text)) return 'Destilado';
  return 'Tinto';
}

function extractProductLinks(html: string, baseUrl: string) {
  const links = new Map<string, { nombre: string; producto_url: string }>();
  const blocks = html.match(/<article[\s\S]*?<\/article>|<div[^>]+(?:product|thumbnail|js-product)[^>]*>[\s\S]*?<\/div>\s*<\/div>/gi) || [];

  for (const block of blocks) {
    const aTag = block.match(/<a[^>]+href=["'][^"']+["'][^>]*>/i)?.[0] || '';
    const href = attr(aTag, 'href');
    if (!href) continue;
    const title = attr(aTag, 'title') || cleanText(block.match(/<h[1-4][^>]*>[\s\S]*?<\/h[1-4]>/i)?.[0] || '');
    const productUrl = absoluteUrl(href, baseUrl);
    if (productUrl && title && !/carrito|login|contacto|categoria|category/i.test(productUrl)) {
      links.set(productUrl, { nombre: title, producto_url: productUrl });
    }
  }

  if (links.size === 0) {
    const anchorMatches = html.match(/<a[^>]+href=["'][^"']+["'][^>]*>[\s\S]*?<\/a>/gi) || [];
    for (const a of anchorMatches) {
      const href = attr(a, 'href');
      const productUrl = absoluteUrl(href, baseUrl);
      const text = cleanText(a);
      if (productUrl && text && /\.html($|\?)/i.test(productUrl) && !/carrito|login|contacto/i.test(productUrl)) {
        links.set(productUrl, { nombre: text, producto_url: productUrl });
      }
    }
  }

  return Array.from(links.values());
}

function extractCharacteristics(html: string) {
  const characteristics: Record<string, string> = {};
  const cleaned = html.replace(/\n/g, ' ');
  const rows = cleaned.match(/<tr[\s\S]*?<\/tr>/gi) || [];

  for (const row of rows) {
    const cells = row.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) || [];
    if (cells.length >= 2) {
      const key = cleanText(cells[0]).replace(/:$/, '');
      const value = cleanText(cells.slice(1).join(' '));
      if (key && value && !/precio|stock|cantidad|carrito/i.test(key)) characteristics[key] = value;
    }
  }

  const listItems = cleaned.match(/<li[^>]*>[\s\S]*?<\/li>/gi) || [];
  for (const li of listItems) {
    const text = cleanText(li);
    const parts = text.split(':');
    if (parts.length >= 2) {
      const key = parts.shift()?.trim() || '';
      const value = parts.join(':').trim();
      if (key && value && key.length < 40 && !/precio|stock|cantidad|carrito/i.test(key)) characteristics[key] = value;
    }
  }

  return characteristics;
}

function extractMainImage(html: string, baseUrl: string) {
  const metaImage = findMeta(html, 'og:image');
  if (metaImage) return absoluteUrl(metaImage, baseUrl);
  const productImageBlock = html.match(/<(?:img|source)[^>]+(?:product|cover|large|zoom)[^>]*>/i)?.[0] || '';
  const srcFromBlock = attr(productImageBlock, 'data-src') || attr(productImageBlock, 'src') || attr(productImageBlock, 'data-full-size-image-url');
  if (srcFromBlock) return absoluteUrl(srcFromBlock, baseUrl);
  const firstImage = html.match(/<img[^>]+>/i)?.[0] || '';
  return absoluteUrl(attr(firstImage, 'data-src') || attr(firstImage, 'src'), baseUrl);
}

function extractDescription(html: string) {
  const candidates = [
    html.match(/<div[^>]+class=["'][^"']*product-description[^"']*["'][^>]*>[\s\S]*?<\/div>/i)?.[0],
    html.match(/<section[^>]+id=["']description["'][^>]*>[\s\S]*?<\/section>/i)?.[0],
    html.match(/<div[^>]+id=["']description["'][^>]*>[\s\S]*?<\/div>/i)?.[0],
    findMeta(html, 'description')
  ].filter(Boolean);
  return cleanText(candidates[0] || '');
}

function possibleBodegaFromTitle(title: string) {
  const text = title.replace(/\b(vino|botella|750\s*ml|ml|malbec|cabernet sauvignon|cabernet franc|chardonnay|torrontés|torrontes|blend|espumante|brut|extra brut|brut nature|reserva|reserve|gran reserva)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const pieces = text.split(/-|–|\|/).map(x => x.trim()).filter(Boolean);
  return pieces.length > 1 ? pieces[pieces.length - 1] : '';
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; DolceVinoImporter/1.0)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    },
    next: { revalidate: 0 }
  });
  if (!response.ok) throw new Error(`No se pudo acceder: ${response.status}`);
  return await response.text();
}


function extractNextPageUrl(html: string, baseUrl: string) {
  const anchors = html.match(/<a[^>]+href=["'][^"']+["'][^>]*>[\s\S]*?<\/a>/gi) || [];

  for (const a of anchors) {
    const href = attr(a, 'href');
    const rel = attr(a, 'rel');
    const className = attr(a, 'class');
    const text = cleanText(a).toLowerCase();

    if (!href) continue;

    const looksNext =
      /next/i.test(rel) ||
      /next|siguiente/i.test(className) ||
      text === 'siguiente' ||
      text.includes('siguiente');

    if (looksNext) return absoluteUrl(href, baseUrl);
  }

  return '';
}

async function collectProductLinksFromPagination(startUrl: string, limit: number, maxPages: number) {
  const collected = new Map<string, { nombre: string; producto_url: string }>();
  const visitedPages = new Set<string>();
  let currentUrl = startUrl;
  let page = 1;

  while (currentUrl && page <= maxPages && collected.size < limit) {
    if (visitedPages.has(currentUrl)) break;
    visitedPages.add(currentUrl);

    const html = await fetchHtml(currentUrl);
    const links = extractProductLinks(html, currentUrl);

    for (const item of links) {
      if (!collected.has(item.producto_url)) collected.set(item.producto_url, item);
      if (collected.size >= limit) break;
    }

    const nextUrl = extractNextPageUrl(html, currentUrl);
    if (!nextUrl || visitedPages.has(nextUrl)) break;

    currentUrl = nextUrl;
    page += 1;
  }

  return Array.from(collected.values()).slice(0, limit);
}

function isProbablyProductUrl(url = '') {
  return /\.html(?:$|\?)/i.test(url);
}

async function scrapeProduct(url: string, fallbackName = ''): Promise<ImportedProduct> {
  const html = await fetchHtml(url);
  const title = cleanText(html.match(/<h1[^>]*>[\s\S]*?<\/h1>/i)?.[0] || findMeta(html, 'og:title') || fallbackName);
  const notas = extractDescription(html);
  const caracteristicas = extractCharacteristics(html);
  const imagen = extractMainImage(html, url);
  const joined = `${title} ${notas} ${Object.values(caracteristicas).join(' ')}`;

  const bodega = caracteristicas.Bodega || caracteristicas.Marca || caracteristicas.Productor || possibleBodegaFromTitle(title);
  const varietal = caracteristicas.Varietal || caracteristicas.Cepa || detectVarietal(joined);

  return {
    nombre: title || fallbackName,
    bodega: bodega || '',
    categoria: detectCategory(joined),
    varietal: varietal || '',
    tipo: caracteristicas.Tipo || detectType(joined),
    notas,
    caracteristicas,
    imagen_original_url: imagen,
    publicado: false
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = String(body.url || '');
    const limit = Math.min(Number(body.limit || 40), 300);

    if (!url || !/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: 'URL inválida' }, { status: 400 });
    }

    const maxPages = Math.min(Number(body.maxPages || 5), 30);

    let links = isProbablyProductUrl(url)
      ? [{ nombre: '', producto_url: url }]
      : await collectProductLinksFromPagination(url, limit, maxPages);

    if (links.length === 0) links = [{ nombre: '', producto_url: url }];

    const products: ImportedProduct[] = [];
    for (const item of links) {
      try {
        const product = await scrapeProduct(item.producto_url, item.nombre);
        if (product.nombre) products.push(product);
      } catch {
        // Ignora productos individuales que fallen para no cortar toda la importación.
      }
    }

    return NextResponse.json({ products });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error al importar' }, { status: 500 });
  }
}
