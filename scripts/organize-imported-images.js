/**
 * Organiza imágenes importadas por tipo y varietal.
 *
 * Uso recomendado:
 * node scripts/organize-imported-images.js tintos
 *
 * Opcional:
 * node scripts/organize-imported-images.js tintos --move
 *
 * - Lee: data/imported-products.json
 * - Toma imágenes desde: public/products/imported
 * - Crea carpetas como:
 *   public/products/tintos/malbec
 *   public/products/tintos/cabernet-sauvignon
 *   public/products/tintos/blend
 * - Actualiza data/imported-products.json con la nueva imagen_url.
 * - Guarda backup automático del JSON antes de modificarlo.
 */

const fs = require('fs');
const path = require('path');

const PRODUCT_TYPE = process.argv[2] || 'tintos';
const SHOULD_MOVE = process.argv.includes('--move');

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'imported-products.json');
const IMPORTED_DIR = path.join(ROOT, 'public', 'products', 'imported');
const DEST_BASE_DIR = path.join(ROOT, 'public', 'products', PRODUCT_TYPE);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function slugify(value = '') {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' y ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'sin-varietal';
}

function cleanText(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

const VARIETAL_RULES = [
  { key: 'cabernet franc', tests: ['cabernet franc', 'cab franc'] },
  { key: 'cabernet sauvignon', tests: ['cabernet sauvignon', 'cab sauvignon'] },
  { key: 'malbec', tests: ['malbec'] },
  { key: 'bonarda', tests: ['bonarda'] },
  { key: 'pinot noir', tests: ['pinot noir'] },
  { key: 'merlot', tests: ['merlot'] },
  { key: 'syrah', tests: ['syrah', 'shiraz'] },
  { key: 'tempranillo', tests: ['tempranillo'] },
  { key: 'sangiovese', tests: ['sangiovese'] },
  { key: 'tannat', tests: ['tannat'] },
  { key: 'petit verdot', tests: ['petit verdot', 'petit-verdot'] },
  { key: 'blend', tests: ['blend', 'corte', 'red blend', 'ensamblaje', 'assemblage'] },
];

function inferVarietal(product) {
  const explicit = cleanText(product.varietal || product.cepa || product.uva || '');
  if (explicit) return explicit;

  const haystack = [
    product.nombre,
    product.name,
    product.titulo,
    product.title,
    product.categoria,
    product.category,
    product.tipo,
    product.notas,
    product.descripcion,
    product.caracteristicas ? JSON.stringify(product.caracteristicas) : '',
    product.producto_url,
    product.fuente_url,
    product.imagen_url,
  ]
    .filter(Boolean)
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  for (const rule of VARIETAL_RULES) {
    if (rule.tests.some((test) => haystack.includes(test))) {
      return rule.key;
    }
  }

  return 'Sin varietal';
}

function getImagePath(product) {
  const raw = product.imagen_url || product.image_url || product.imagen || '';
  if (!raw) return null;

  if (raw.startsWith('/')) {
    return path.join(ROOT, 'public', raw.replace(/^\//, ''));
  }

  if (raw.includes('/products/imported/')) {
    const filename = raw.split('/products/imported/').pop();
    return path.join(IMPORTED_DIR, filename);
  }

  if (!raw.startsWith('http')) {
    return path.join(ROOT, raw);
  }

  return null;
}

function uniqueDestPath(destDir, filename) {
  const parsed = path.parse(filename);
  let candidate = path.join(destDir, filename);
  let index = 2;

  while (fs.existsSync(candidate)) {
    candidate = path.join(destDir, `${parsed.name}-${index}${parsed.ext}`);
    index += 1;
  }

  return candidate;
}

function main() {
  if (!fs.existsSync(DATA_FILE)) {
    console.error(`No encontré el archivo: ${DATA_FILE}`);
    process.exit(1);
  }

  ensureDir(DEST_BASE_DIR);

  const products = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const backupFile = DATA_FILE.replace('.json', `.backup-${Date.now()}.json`);
  fs.copyFileSync(DATA_FILE, backupFile);

  let copied = 0;
  let skipped = 0;
  let missing = 0;

  const updatedProducts = products.map((product) => {
    const imagePath = getImagePath(product);

    if (!imagePath) {
      skipped += 1;
      return product;
    }

    if (!fs.existsSync(imagePath)) {
      missing += 1;
      console.log(`Imagen no encontrada: ${imagePath}`);
      return product;
    }

    const varietal = inferVarietal(product);
    const varietalSlug = slugify(varietal);
    const destDir = path.join(DEST_BASE_DIR, varietalSlug);
    ensureDir(destDir);

    const filename = path.basename(imagePath);
    const destPath = uniqueDestPath(destDir, filename);

    if (SHOULD_MOVE) {
      fs.renameSync(imagePath, destPath);
    } else {
      fs.copyFileSync(imagePath, destPath);
    }

    copied += 1;

    const publicUrl = `/products/${PRODUCT_TYPE}/${varietalSlug}/${path.basename(destPath)}`;

    return {
      ...product,
      tipo: product.tipo || PRODUCT_TYPE,
      varietal,
      imagen_url: publicUrl,
    };
  });

  fs.writeFileSync(DATA_FILE, JSON.stringify(updatedProducts, null, 2), 'utf8');

  console.log('Organización finalizada.');
  console.log(`Tipo/carpeta principal: ${PRODUCT_TYPE}`);
  console.log(`Imágenes copiadas${SHOULD_MOVE ? ' / movidas' : ''}: ${copied}`);
  console.log(`Productos sin imagen: ${skipped}`);
  console.log(`Imágenes no encontradas: ${missing}`);
  console.log(`Backup JSON: ${backupFile}`);
  console.log(`JSON actualizado: ${DATA_FILE}`);
}

main();
