const fs = require('fs');
const path = require('path');
const slugify = require('slugify');

const collection = process.argv[2] || 'tintos';
const moveMode = !process.argv.includes('--copy'); // default: move

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'imported-products.json');
const PRODUCTS_ROOT = path.join(ROOT, 'public', 'products', collection);
const BLEND_DIR = path.join(PRODUCTS_ROOT, 'blend');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

function backupFile(file) {
  const backup = file.replace(/\.json$/i, `.${Date.now()}.bak.json`);
  fs.copyFileSync(file, backup);
  return backup;
}

function cleanText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function productSlug(product) {
  const base = product?.nombre || product?.name || 'producto';
  return slugify(base, { lower: true, strict: true, trim: true });
}

function isBlendProduct(product) {
  const fields = [
    product?.varietal,
    product?.tipo,
    product?.categoria,
    product?.nombre,
    product?.notas,
    typeof product?.caracteristicas === 'string'
      ? product.caracteristicas
      : JSON.stringify(product?.caracteristicas || {}),
  ]
    .map(cleanText)
    .join(' | ');

  return (
    fields.includes('blend') ||
    fields.includes('corte') ||
    fields.includes('assemblage') ||
    fields.includes('field blend')
  );
}

function fileExists(file) {
  try {
    return fs.existsSync(file) && fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

function listFilesRecursive(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFilesRecursive(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

function findCurrentImage(product) {
  const candidates = [];
  if (product?.imagen_url) {
    const rel = String(product.imagen_url).replace(/^\/+/, '');
    candidates.push(path.join(ROOT, 'public', rel.replace(/^products\//, 'products/')));
  }

  const slug = productSlug(product);
  const allFiles = listFilesRecursive(PRODUCTS_ROOT);

  // exact filename by slug or startsWith slug
  const matches = allFiles.filter((f) => {
    const parsed = path.parse(f);
    return parsed.name === slug || parsed.base.startsWith(`${slug}.`) || parsed.name.startsWith(slug);
  });

  candidates.push(...matches);

  for (const file of candidates) {
    if (fileExists(file)) return file;
  }
  return null;
}

function relativePublicPath(absPath) {
  const publicRoot = path.join(ROOT, 'public');
  const rel = path.relative(publicRoot, absPath).replace(/\\/g, '/');
  return `/${rel}`;
}

function safeMoveOrCopy(source, dest) {
  ensureDir(path.dirname(dest));
  if (path.resolve(source) === path.resolve(dest)) return;

  if (fileExists(dest)) {
    // if exact destination exists, remove source if different and move mode is on
    if (moveMode && path.resolve(source) !== path.resolve(dest)) {
      try { fs.unlinkSync(source); } catch {}
    }
    return;
  }

  if (moveMode) {
    fs.renameSync(source, dest);
  } else {
    fs.copyFileSync(source, dest);
  }
}

function removeIfExists(file) {
  try {
    if (fileExists(file)) fs.unlinkSync(file);
  } catch {}
}

function main() {
  if (!fs.existsSync(DATA_FILE)) {
    console.error(`No se encontró el archivo: ${DATA_FILE}`);
    process.exit(1);
  }

  if (!fs.existsSync(PRODUCTS_ROOT)) {
    console.error(`No se encontró la carpeta: ${PRODUCTS_ROOT}`);
    process.exit(1);
  }

  ensureDir(BLEND_DIR);

  const products = readJson(DATA_FILE);
  if (!Array.isArray(products)) {
    console.error('El JSON no tiene un array de productos.');
    process.exit(1);
  }

  const backup = backupFile(DATA_FILE);
  console.log(`Backup creado: ${backup}`);

  const movedBlendFiles = new Set();
  let updatedProducts = 0;
  let movedFiles = 0;

  for (const product of products) {
    if (!isBlendProduct(product)) continue;

    const currentImage = findCurrentImage(product);
    if (!currentImage) {
      console.log(`No se encontró imagen para blend: ${product.nombre || 'sin nombre'}`);
      continue;
    }

    const ext = path.extname(currentImage) || '.jpg';
    const destFile = path.join(BLEND_DIR, `${productSlug(product)}${ext}`);

    if (path.resolve(currentImage) !== path.resolve(destFile)) {
      safeMoveOrCopy(currentImage, destFile);
      movedFiles += 1;
    }

    product.imagen_url = relativePublicPath(destFile);
    product.varietal = 'Blend';
    updatedProducts += 1;
    movedBlendFiles.add(path.basename(destFile));
  }

  // Remove any duplicate blend images from other varietal folders
  const varietalFolders = fs
    .readdirSync(PRODUCTS_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && cleanText(d.name) !== 'blend')
    .map((d) => path.join(PRODUCTS_ROOT, d.name));

  let removedDuplicates = 0;
  for (const folder of varietalFolders) {
    const files = listFilesRecursive(folder);
    for (const file of files) {
      const base = path.basename(file);
      if (movedBlendFiles.has(base)) {
        removeIfExists(file);
        removedDuplicates += 1;
      }
    }
  }

  writeJson(DATA_FILE, products);

  console.log('----------------------------------------');
  console.log(`Colección analizada: ${collection}`);
  console.log(`Productos blend actualizados: ${updatedProducts}`);
  console.log(`${moveMode ? 'Archivos movidos' : 'Archivos copiados'} a blend: ${movedFiles}`);
  console.log(`Duplicados eliminados del resto: ${removedDuplicates}`);
  console.log(`Carpeta destino: ${BLEND_DIR}`);
  console.log('Listo.');
}

main();
