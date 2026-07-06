/*
  Importador privado de productos para Dolce Vino.

  Uso:
    node scripts/scrape-products.js "https://URL-DE-CATEGORIA-O-PRODUCTO"

  Qué guarda:
    - nombre
    - bodega detectada si aparece
    - categoria
    - varietal detectado si aparece
    - tipo
    - notas / descripcion
    - caracteristicas técnicas detectadas
    - imagen descargada en /public/products/imported

  Qué ignora:
    - precios
    - stock
    - carrito
    - nombre visible de la fuente
*/

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const START_URL = process.argv[2];
const LIMIT = Number(process.argv[3] || 1000);
const MAX_PAGES = Number(process.argv[4] || 30);

if (!START_URL) {
  console.error('Uso: node scripts/scrape-products.js "https://URL" [limite] [maxPaginas]');
  process.exit(1);
}

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, 'data');
const IMAGE_DIR = path.join(ROOT, 'public', 'products', 'imported');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'imported-products.json');

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.mkdirSync(IMAGE_DIR, { recursive: true });

const VARIETALS = [
  'Malbec', 'Cabernet Sauvignon', 'Cabernet Franc', 'Merlot', 'Pinot Noir', 'Syrah',
  'Bonarda', 'Petit Verdot', 'Tannat', 'Tempranillo', 'Sangiovese', 'Blend', 'Red Blend',
  'Chardonnay', 'Sauvignon Blanc', 'Torrontés', 'Torrontes', 'Viognier', 'Semillon',
  'Riesling', 'Chenin', 'Rosé', 'Rose', 'Espumante', 'Brut', 'Extra Brut', 'Brut Nature',
  'Dulce Natural', 'Gin', 'Whisky', 'Vodka', 'Ron', 'Aperitivo', 'Vermut', 'Vermouth'
];

const CATEGORY_WORDS = [
  { match: /espumante|champagne|brut/i, value: 'Espumantes' },
  { match: /gin|whisky|vodka|ron|aperitivo|vermut|vermouth|destilado/i, value: 'Destilados' },
  { match: /aceite|chocolate|conserva|delicatessen|gourmet|pasta|salsa/i, value: 'Delicatessen' },
  { match: /vino|malbec|cabernet|chardonnay|torront/i, value: 'Vinos' }
];

function cleanText(value = '') {
  return decodeHtml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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

function slugify(value = 'producto') {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 90) || 'producto';
}

function absoluteUrl(url, base) {
  if (!url) return '';
  try { return new URL(url, base).href; } catch { return ''; }
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; DolceVinoImporter/1.0)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });
  if (!res.ok) throw new Error(`No se pudo acceder: ${res.status} ${res.statusText}`);
  return await res.text();
}

function attr(tag, name) {
  const reg = new RegExp(`${name}=["']([^"']+)["']`, 'i');
  const match = tag.match(reg);
  return match ? decodeHtml(match[1]) : '';
}

function findMeta(html, property) {
  const reg = new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
  const match = html.match(reg);
  return match ? decodeHtml(match[1]) : '';
}

function detectVarietal(text) {
  const found = VARIETALS.find(v => new RegExp(`\\b${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text));
  if (!found) return '';
  if (/torrontes/i.test(found)) return 'Torrontés';
  if (/rose/i.test(found)) return 'Rosé';
  return found;
}

function detectCategory(text) {
  return CATEGORY_WORDS.find(item => item.match.test(text))?.value || 'Vinos';
}

function detectType(text) {
  if (/blanco|chardonnay|sauvignon|torront|viognier|semillon|riesling|chenin/i.test(text)) return 'Blanco';
  if (/rosado|rosé|rose/i.test(text)) return 'Rosado';
  if (/espumante|brut|champagne/i.test(text)) return 'Espumante';
  if (/gin|whisky|vodka|ron|vermut|vermouth|destilado/i.test(text)) return 'Destilado';
  return 'Tinto';
}

function possibleBodegaFromTitle(title) {
  const text = title.replace(/\b(vino|botella|750\s*ml|ml|malbec|cabernet sauvignon|cabernet franc|chardonnay|torrontés|torrontes|blend|espumante|brut|extra brut|brut nature|reserva|reserve|gran reserva)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const pieces = text.split(/-|–|\|/).map(x => x.trim()).filter(Boolean);
  return pieces.length > 1 ? pieces[pieces.length - 1] : '';
}

function extractProductLinks(html, baseUrl) {
  const links = new Map();
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
      if (!productUrl || !text) continue;
      if (/\.html($|\?)/i.test(productUrl) && !/carrito|login|contacto/i.test(productUrl)) {
        links.set(productUrl, { nombre: text, producto_url: productUrl });
      }
    }
  }

  return Array.from(links.values());
}

function extractCharacteristics(html) {
  const characteristics = {};
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
      const key = parts.shift().trim();
      const value = parts.join(':').trim();
      if (key && value && key.length < 40 && !/precio|stock|cantidad|carrito/i.test(key)) characteristics[key] = value;
    }
  }

  return characteristics;
}

function extractMainImage(html, baseUrl) {
  const metaImage = findMeta(html, 'og:image');
  if (metaImage) return absoluteUrl(metaImage, baseUrl);

  const productImageBlock = html.match(/<(?:img|source)[^>]+(?:product|cover|large|zoom)[^>]*>/i)?.[0] || '';
  const srcFromBlock = attr(productImageBlock, 'data-src') || attr(productImageBlock, 'src') || attr(productImageBlock, 'data-full-size-image-url');
  if (srcFromBlock) return absoluteUrl(srcFromBlock, baseUrl);

  const firstImage = html.match(/<img[^>]+>/i)?.[0] || '';
  return absoluteUrl(attr(firstImage, 'data-src') || attr(firstImage, 'src'), baseUrl);
}

function extractDescription(html) {
  const candidates = [
    html.match(/<div[^>]+class=["'][^"']*product-description[^"']*["'][^>]*>[\s\S]*?<\/div>/i)?.[0],
    html.match(/<section[^>]+id=["']description["'][^>]*>[\s\S]*?<\/section>/i)?.[0],
    html.match(/<div[^>]+id=["']description["'][^>]*>[\s\S]*?<\/div>/i)?.[0],
    findMeta(html, 'description')
  ].filter(Boolean);

  return cleanText(candidates[0] || '');
}

async function downloadImage(imageUrl, productName) {
  if (!imageUrl) return '';
  try {
    const res = await fetch(imageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return '';
    const contentType = res.headers.get('content-type') || '';
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 1000) return '';
    const hash = crypto.createHash('md5').update(imageUrl).digest('hex').slice(0, 8);
    const filename = `${slugify(productName)}-${hash}.${ext}`;
    const filePath = path.join(IMAGE_DIR, filename);
    fs.writeFileSync(filePath, buffer);
    return `/products/imported/${filename}`;
  } catch {
    return '';
  }
}


function isProbablyProductUrl(url = '') {
  return /\.html(?:$|\?)/i.test(url);
}

function extractNextPageUrl(html, baseUrl) {
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

async function collectProductLinksFromPagination(startUrl, limit, maxPages) {
  const collected = new Map();
  const visitedPages = new Set();
  let currentUrl = startUrl;
  let page = 1;

  while (currentUrl && page <= maxPages && collected.size < limit) {
    if (visitedPages.has(currentUrl)) break;
    visitedPages.add(currentUrl);

    console.log(`Leyendo página ${page}: ${currentUrl}`);
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
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  return Array.from(collected.values()).slice(0, limit);
}

async function scrapeProduct(url, fallbackName = '') {
  const html = await fetchHtml(url);
  const title = cleanText(html.match(/<h1[^>]*>[\s\S]*?<\/h1>/i)?.[0] || findMeta(html, 'og:title') || fallbackName);
  const description = extractDescription(html);
  const characteristics = extractCharacteristics(html);
  const imageOriginal = extractMainImage(html, url);
  const localImage = await downloadImage(imageOriginal, title || fallbackName);
  const joined = `${title} ${description} ${Object.values(characteristics).join(' ')}`;

  const bodega = characteristics.Bodega || characteristics.Marca || characteristics.Productor || possibleBodegaFromTitle(title);
  const varietal = characteristics.Varietal || characteristics.Cepa || detectVarietal(joined);

  return {
    id: slugify(title || fallbackName),
    nombre: title || fallbackName,
    bodega: bodega || '',
    categoria: detectCategory(joined),
    varietal: varietal || '',
    tipo: characteristics.Tipo || detectType(joined),
    notas: description,
    caracteristicas: characteristics,
    imagen_url: localImage,
    publicado: false
  };
}

async function main() {
  console.log('Leyendo URL inicial...');

  let links = [];

  if (isProbablyProductUrl(START_URL)) {
    links = [{ nombre: '', producto_url: START_URL }];
  } else {
    links = await collectProductLinksFromPagination(START_URL, LIMIT, MAX_PAGES);
  }

  if (links.length === 0) {
    console.log('No se detectó listado. Se tratará como producto individual.');
    links = [{ nombre: '', producto_url: START_URL }];
  }

  console.log(`Productos detectados: ${links.length}`);
  console.log(`Límite: ${LIMIT} | Máximo de páginas: ${MAX_PAGES}`);

  const results = [];
  for (const [index, product] of links.entries()) {
    try {
      console.log(`[${index + 1}/${links.length}] Importando: ${product.nombre || product.producto_url}`);
      const detail = await scrapeProduct(product.producto_url, product.nombre);
      if (detail.nombre) results.push(detail);
      await new Promise(resolve => setTimeout(resolve, 450));
    } catch (error) {
      console.log('  Error:', error.message);
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), 'utf-8');
  console.log('\nImportación finalizada.');
  console.log(`JSON: ${OUTPUT_FILE}`);
  console.log(`Imágenes: ${IMAGE_DIR}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
