const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const BODEGAS_ROOT = path.join(ROOT, 'public', 'products', 'bodegas');
const OUTPUT = path.join(ROOT, 'data', 'bodegas-catalog.json');
const EXISTING = fs.existsSync(OUTPUT) ? readJson(OUTPUT, []) : [];

const IMAGE_EXT = /\.(png|jpg|jpeg|webp|svg)$/i;
const GENERATED_LOGOS = new Set(['logo-clean.png', 'logo-white.png', 'logo-gold.png', 'logo-original.png']);

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function normalize(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function slugify(value = 'item') {
  return normalize(value)
    .replace(/&/g, ' y ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

const SPECIAL_NAMES = {
  'vina-cobos': 'Viña Cobos',
  'nina': 'Niña',
  'chanarmuyo': 'Chañarmuyo',
  'dona-paula': 'Doña Paula',
  'pena-flor': 'Peñaflor',
  'grupo-penaflor': 'Grupo Peñaflor',
  'canepa-martin': 'Cánepa Martin',
  'bodega-canepa-martin': 'Bodega Cánepa Martin',
};

function titleCaseFromSlug(slug) {
  if (SPECIAL_NAMES[slug]) return SPECIAL_NAMES[slug];
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
    .replace(/\bY\b/g, 'y')
    .replace(/\bDe\b/g, 'de')
    .replace(/\bDel\b/g, 'del')
    .replace(/\bLa\b/g, 'La')
    .replace(/\bLos\b/g, 'Los')
    .replace(/\bLas\b/g, 'Las')
    .replace(/\bVina\b/g, 'Viña')
    .replace(/\bNina\b/g, 'Niña')
    .replace(/\bDona\b/g, 'Doña')
    .replace(/\bPenaflor\b/g, 'Peñaflor')
    .replace(/\bChanarmuyo\b/g, 'Chañarmuyo')
    .replace(/\bCanepa\b/g, 'Cánepa');
}

function productNameFromFile(fileName) {
  return titleCaseFromSlug(path.parse(fileName).name);
}

function publicPath(absPath) {
  const publicRoot = path.join(ROOT, 'public');
  return '/' + path.relative(publicRoot, absPath).replace(/\\/g, '/');
}

function findOriginalLogo(brandDir) {
  const files = fs.readdirSync(brandDir).filter((file) => IMAGE_EXT.test(file));
  const original = files.find((file) => /^logo\./i.test(file) && !GENERATED_LOGOS.has(file.toLowerCase()));
  if (original) return publicPath(path.join(brandDir, original));
  const anyLogo = files.find((file) => file.toLowerCase().startsWith('logo-') && !GENERATED_LOGOS.has(file.toLowerCase()));
  return anyLogo ? publicPath(path.join(brandDir, anyLogo)) : '';
}

function existingById() {
  const bodegas = new Map();
  const products = new Map();

  if (Array.isArray(EXISTING)) {
    for (const bodega of EXISTING) {
      if (!bodega?.id) continue;
      bodegas.set(bodega.id, bodega);
      for (const product of bodega.productos || []) {
        if (product?.id) products.set(product.id, product);
      }
    }
  }

  return { bodegas, products };
}

function main() {
  if (!fs.existsSync(BODEGAS_ROOT)) {
    console.error(`No existe la carpeta: ${BODEGAS_ROOT}`);
    console.error('Primero generá la estructura public/products/bodegas/<bodega>/...');
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });

  const { bodegas: existingBodegas, products: existingProducts } = existingById();

  const brandDirs = fs
    .readdirSync(BODEGAS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(BODEGAS_ROOT, entry.name))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));

  const catalog = [];

  for (const brandDir of brandDirs) {
    const slug = path.basename(brandDir);
    const id = slug;
    const existingBodega = existingBodegas.get(id);

    const bodega = {
      id,
      nombre: existingBodega?.nombre || titleCaseFromSlug(slug),
      slug,
      habilitada: existingBodega?.habilitada ?? true,
      logo_gold: fs.existsSync(path.join(brandDir, 'logo-gold.png')) ? publicPath(path.join(brandDir, 'logo-gold.png')) : '',
      logo_white: fs.existsSync(path.join(brandDir, 'logo-white.png')) ? publicPath(path.join(brandDir, 'logo-white.png')) : '',
      logo_clean: fs.existsSync(path.join(brandDir, 'logo-clean.png')) ? publicPath(path.join(brandDir, 'logo-clean.png')) : '',
      logo_original: findOriginalLogo(brandDir),
      productos: [],
    };

    const varietalDirs = fs
      .readdirSync(brandDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(brandDir, entry.name))
      .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));

    for (const varietalDir of varietalDirs) {
      const varietalSlug = path.basename(varietalDir);
      const varietalName = titleCaseFromSlug(varietalSlug);
      const imageFiles = fs
        .readdirSync(varietalDir)
        .filter((file) => IMAGE_EXT.test(file))
        // Evita duplicar vinos generados por scripts de limpieza de fondo.
        // El sitio público muestra la imagen original sobre una base blanca.
        .filter((file) => !file.toLowerCase().includes('-transparent.'))
        .filter((file) => !file.toLowerCase().includes('-clean.'))
        .sort((a, b) => a.localeCompare(b));

      for (const file of imageFiles) {
        const productSlug = slugify(path.parse(file).name);
        const productId = `${slug}-${varietalSlug}-${productSlug}`;
        const existingProduct = existingProducts.get(productId);

        bodega.productos.push({
          id: productId,
          nombre: existingProduct?.nombre || productNameFromFile(file),
          slug: productSlug,
          varietal: existingProduct?.varietal || varietalName,
          varietal_slug: varietalSlug,
          imagen_url: existingProduct?.imagen_url || publicPath(path.join(varietalDir, file)),
          precio: existingProduct?.precio ?? 0,
          tamano: existingProduct?.tamano || '750 ml',
          caracteristicas: existingProduct?.caracteristicas || '',
          habilitado: existingProduct?.habilitado ?? true,
        });
      }
    }

    catalog.push(bodega);
  }

  fs.writeFileSync(OUTPUT, JSON.stringify(catalog, null, 2), 'utf8');

  const totalProducts = catalog.reduce((sum, bodega) => sum + bodega.productos.length, 0);

  console.log('Listo.');
  console.log(`Bodegas: ${catalog.length}`);
  console.log(`Productos: ${totalProducts}`);
  console.log(`Archivo generado: ${OUTPUT}`);
}

main();
