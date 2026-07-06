const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = process.cwd();
const BODEGAS_ROOT = path.join(ROOT, 'public', 'products', 'bodegas');
const CATALOG = path.join(ROOT, 'data', 'bodegas-catalog.json');
const IMAGE_EXT = /\.(png|jpg|jpeg|webp)$/i;

function isLogo(file) {
  return /^logo/i.test(path.basename(file));
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && IMAGE_EXT.test(entry.name) && !isLogo(entry.name) && !entry.name.includes('-transparent.')) out.push(full);
  }
  return out;
}

function publicPath(absPath) {
  return '/' + path.relative(path.join(ROOT, 'public'), absPath).replace(/\\/g, '/');
}

async function removeBackground(inputPath) {
  const parsed = path.parse(inputPath);
  const outputPath = path.join(parsed.dir, `${parsed.name}-transparent.png`);

  const { data, info } = await sharp(inputPath, { density: 300 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = Buffer.from(data);
  const channels = info.channels;

  for (let i = 0; i < out.length; i += channels) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);

    // Blanco o gris muy claro típico de fondos de producto.
    if (r > 236 && g > 236 && b > 236 && max - min < 26) {
      out[i + 3] = 0;
      continue;
    }

    // Bordes casi blancos: suavizar.
    if (r > 218 && g > 218 && b > 218 && max - min < 34) {
      const alpha = Math.max(0, Math.min(255, (242 - max) * 9));
      out[i + 3] = Math.min(out[i + 3], alpha);
      continue;
    }

    // Fondo negro/casi negro plano: no lo quitamos agresivo porque muchas botellas son negras.
  }

  await sharp(out, {
    raw: { width: info.width, height: info.height, channels },
  })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 })
    .resize({ width: 900, height: 1200, fit: 'inside', withoutEnlargement: true })
    .png()
    .toFile(outputPath);

  return outputPath;
}

function updateCatalog(pathMap) {
  if (!fs.existsSync(CATALOG)) return;
  const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
  let updates = 0;

  for (const bodega of catalog) {
    for (const product of bodega.productos || []) {
      const abs = path.join(ROOT, 'public', product.imagen_url.replace(/^\//, ''));
      const next = pathMap.get(abs);
      if (next) {
        product.imagen_url = publicPath(next);
        updates += 1;
      }
    }
  }

  const backup = CATALOG.replace(/\.json$/i, `.${Date.now()}.bak.json`);
  fs.copyFileSync(CATALOG, backup);
  fs.writeFileSync(CATALOG, JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`JSON actualizado: ${CATALOG}`);
  console.log(`Backup creado: ${backup}`);
  console.log(`Productos actualizados: ${updates}`);
}

async function main() {
  if (!fs.existsSync(BODEGAS_ROOT)) {
    console.error(`No existe ${BODEGAS_ROOT}`);
    process.exit(1);
  }

  const files = walk(BODEGAS_ROOT);
  console.log(`Imágenes de vinos detectadas: ${files.length}`);

  const pathMap = new Map();
  let ok = 0;
  let failed = 0;

  for (const file of files) {
    try {
      const out = await removeBackground(file);
      pathMap.set(file, out);
      ok += 1;
      console.log(`OK: ${path.relative(ROOT, out)}`);
    } catch (error) {
      failed += 1;
      console.log(`ERROR: ${path.relative(ROOT, file)} - ${error.message}`);
    }
  }

  updateCatalog(pathMap);
  console.log('----------------------------------------');
  console.log(`Procesadas: ${ok}`);
  console.log(`Errores: ${failed}`);
  console.log('Listo.');
}

main();
