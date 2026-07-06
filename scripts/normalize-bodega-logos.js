const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

/**
 * Normalizador de logos por bodega - V2 corregido
 *
 * Busca:
 * public/products/bodegas/<bodega>/logo.*
 *
 * Genera dentro de cada bodega:
 * logo-clean.png       -> logo con fondo transparente, manteniendo color original
 * logo-white.png       -> logo blanco, fondo transparente
 * logo-gold.png        -> logo dorado, fondo transparente
 *
 * Corrige el problema de la versión anterior que podía generar rectángulos completos
 * dorados/blancos cuando el logo original tenía fondo sólido.
 */

const ROOT = process.cwd();
const BODEGAS_ROOT = path.join(ROOT, "public", "products", "bodegas");
const OUTPUT_JSON = path.join(ROOT, "data", "bodegas-logos-normalized.json");

const GOLD = process.argv[2] || "#C9A14A";
const CANVAS_WIDTH = Number(process.argv[3] || 420);
const CANVAS_HEIGHT = Number(process.argv[4] || 220);
const LOGO_MAX_WIDTH = Number(process.argv[5] || 330);
const LOGO_MAX_HEIGHT = Number(process.argv[6] || 145);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function isImage(file) {
  return /\.(png|jpg|jpeg|webp)$/i.test(file);
}

function publicPath(absPath) {
  const publicRoot = path.join(ROOT, "public");
  return "/" + path.relative(publicRoot, absPath).replace(/\\/g, "/");
}

function hexToRgb(hex) {
  const cleaned = hex.replace("#", "").trim();
  const full = cleaned.length === 3
    ? cleaned.split("").map((x) => x + x).join("")
    : cleaned;

  const int = parseInt(full, 16);

  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function findLogoFile(brandDir) {
  const files = fs.readdirSync(brandDir);

  const preferred = files
    .filter(isImage)
    .filter((file) => {
      const name = path.parse(file).name.toLowerCase();
      return name === "logo" || name.startsWith("logo.");
    })
    // No volver a procesar resultados generados
    .filter((file) => !file.includes("logo-clean") && !file.includes("logo-white") && !file.includes("logo-gold"));

  if (preferred.length) return path.join(brandDir, preferred[0]);

  return null;
}

async function removeWhiteBackgroundToPng(inputPath, outputPath) {
  /**
   * Toma el logo original, detecta pixeles blancos/casi blancos y los vuelve transparentes.
   * Mantiene los colores originales del logo.
   */
  const { data, info } = await sharp(inputPath, { density: 300 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  const output = Buffer.from(data);

  for (let i = 0; i < output.length; i += channels) {
    const r = output[i];
    const g = output[i + 1];
    const b = output[i + 2];

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);

    // Blanco/casi blanco: transparente
    if (r >= 240 && g >= 240 && b >= 240 && max - min <= 22) {
      output[i + 3] = 0;
      continue;
    }

    // Bordes gris muy claro: alfa progresivo
    if (r >= 222 && g >= 222 && b >= 222 && max - min <= 32) {
      const alpha = Math.max(0, Math.min(255, (240 - max) * 10));
      output[i + 3] = Math.min(output[i + 3], alpha);
    }
  }

  await sharp(output, {
    raw: {
      width: info.width,
      height: info.height,
      channels,
    },
  })
    .png()
    .toFile(outputPath);
}

async function normalizeCanvas(inputPath, outputPath) {
  /**
   * Recorta transparencia, ajusta dentro de un lienzo fijo y mantiene fondo transparente.
   */
  const resizedBuffer = await sharp(inputPath)
    .ensureAlpha()
    .trim({
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      threshold: 8,
    })
    .resize({
      width: LOGO_MAX_WIDTH,
      height: LOGO_MAX_HEIGHT,
      fit: "inside",
      withoutEnlargement: true,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: resizedBuffer,
        gravity: "center",
      },
    ])
    .png()
    .toFile(outputPath);
}

async function recolorNonTransparentPixels(inputPath, outputPath, color) {
  /**
   * Recolorea SOLO los pixeles no transparentes.
   * El alpha sale del logo ya limpio, no del lienzo completo.
   * Además ignora los pixeles demasiado claros que hayan quedado como borde.
   */
  const rgb = hexToRgb(color);

  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  const output = Buffer.alloc(data.length);

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    // Si es transparente, queda transparente
    if (a <= 5) {
      output[i] = 0;
      output[i + 1] = 0;
      output[i + 2] = 0;
      output[i + 3] = 0;
      continue;
    }

    // Si quedó un resto blanco/casi blanco, no pintarlo como bloque
    if (r > 235 && g > 235 && b > 235) {
      output[i] = 0;
      output[i + 1] = 0;
      output[i + 2] = 0;
      output[i + 3] = 0;
      continue;
    }

    // Usar intensidad para conservar bordes finos y antialias
    const darkness = 1 - ((r + g + b) / 3 / 255);
    const finalAlpha = Math.max(0, Math.min(255, Math.round(a * Math.max(0.35, darkness))));

    output[i] = rgb.r;
    output[i + 1] = rgb.g;
    output[i + 2] = rgb.b;
    output[i + 3] = finalAlpha;
  }

  await sharp(output, {
    raw: {
      width: info.width,
      height: info.height,
      channels,
    },
  })
    .png()
    .toFile(outputPath);
}

async function processLogo(brandDir, logoPath) {
  const tempClean = path.join(brandDir, "__logo_clean_tmp.png");
  const cleanOut = path.join(brandDir, "logo-clean.png");
  const whiteOut = path.join(brandDir, "logo-white.png");
  const goldOut = path.join(brandDir, "logo-gold.png");

  await removeWhiteBackgroundToPng(logoPath, tempClean);
  await normalizeCanvas(tempClean, cleanOut);

  await recolorNonTransparentPixels(cleanOut, whiteOut, "#FFFFFF");
  await recolorNonTransparentPixels(cleanOut, goldOut, GOLD);

  try {
    fs.unlinkSync(tempClean);
  } catch {}

  return {
    logo_original_detectado: path.basename(logoPath),
    logo_clean: publicPath(cleanOut),
    logo_white: publicPath(whiteOut),
    logo_gold: publicPath(goldOut),
  };
}

async function main() {
  if (!fs.existsSync(BODEGAS_ROOT)) {
    console.error(`No existe la carpeta: ${BODEGAS_ROOT}`);
    process.exit(1);
  }

  ensureDir(path.dirname(OUTPUT_JSON));

  const brandFolders = fs
    .readdirSync(BODEGAS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(BODEGAS_ROOT, entry.name));

  const results = [];

  console.log(`Bodegas encontradas: ${brandFolders.length}`);
  console.log(`Dorado: ${GOLD}`);
  console.log("----------------------------------------");

  for (const brandDir of brandFolders) {
    const brandSlug = path.basename(brandDir);
    const logoPath = findLogoFile(brandDir);

    if (!logoPath) {
      console.log(`Sin logo original: ${brandSlug}`);
      continue;
    }

    console.log(`Procesando ${brandSlug}: ${path.basename(logoPath)}`);

    try {
      const item = await processLogo(brandDir, logoPath);
      results.push({
        nombre: brandSlug.replace(/-/g, " "),
        carpeta: brandSlug,
        ...item,
      });
    } catch (error) {
      console.log(`Error en ${brandSlug}: ${error.message}`);
    }
  }

  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(results, null, 2), "utf-8");

  console.log("----------------------------------------");
  console.log("Listo.");
  console.log(`Logos procesados: ${results.length}`);
  console.log(`JSON generado: ${OUTPUT_JSON}`);
  console.log("");
  console.log("Usá logo-gold.png o logo-white.png en el carrusel.");
}

main();
