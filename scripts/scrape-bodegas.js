const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

/**
 * Scraper de bodegas V2
 *
 * Estructura generada:
 *
 * public/products/bodegas/
 *   achaval-ferrer/
 *     logo.jpg
 *     malbec/
 *       vino-1.jpg
 *     merlot/
 *       vino-2.jpg
 *     blend/
 *       vino-3.jpg
 *
 * No guarda precios ni stock.
 */

const START_URL = process.argv[2] || "https://solyvinomendoza.com/bodegas";
const MAX_BODEGAS = Number(process.argv[3] || 9999);
const MAX_PRODUCTS_PER_BODEGA = Number(process.argv[4] || 9999);
const MAX_PAGES_PER_BODEGA = Number(process.argv[5] || 80);

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const BODEGAS_ROOT = path.join(ROOT, "public", "products", "bodegas");

const OUTPUT_BODEGAS = path.join(DATA_DIR, "bodegas-imported.json");
const OUTPUT_FLAT = path.join(DATA_DIR, "bodegas-products-flat.json");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(BODEGAS_ROOT, { recursive: true });

function cleanText(value = "") {
  return String(value)
    .replace(/\s+/g, " ")
    .replace(/\n/g, " ")
    .trim();
}

function normalize(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function slugify(value = "item") {
  return normalize(value)
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function absoluteUrl(url, baseUrl) {
  if (!url) return "";
  try {
    return new URL(url, baseUrl).href;
  } catch {
    return "";
  }
}

function extensionFromContentType(contentType = "", fallbackUrl = "") {
  const cleanUrl = fallbackUrl.split("?")[0].toLowerCase();

  if (contentType.includes("webp") || cleanUrl.endsWith(".webp")) return ".webp";
  if (contentType.includes("png") || cleanUrl.endsWith(".png")) return ".png";
  if (contentType.includes("jpeg") || contentType.includes("jpg") || cleanUrl.endsWith(".jpg") || cleanUrl.endsWith(".jpeg")) return ".jpg";
  if (contentType.includes("svg") || cleanUrl.endsWith(".svg")) return ".svg";

  return ".jpg";
}

function publicPath(absPath) {
  const publicRoot = path.join(ROOT, "public");
  const rel = path.relative(publicRoot, absPath).replace(/\\/g, "/");
  return `/${rel}`;
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
      "Referer": new URL(url).origin,
    },
  });

  if (!response.ok) {
    throw new Error(`No se pudo acceder a ${url}. Estado: ${response.status}`);
  }

  return await response.text();
}

async function downloadFile(fileUrl, dir, baseName, forcedName = "") {
  if (!fileUrl) return "";

  try {
    const response = await fetch(fileUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Referer": new URL(fileUrl).origin,
      },
    });

    if (!response.ok) return "";

    const contentType = response.headers.get("content-type") || "";
    const ext = extensionFromContentType(contentType, fileUrl);
    const fileName = forcedName ? `${forcedName}${ext}` : `${slugify(baseName)}${ext}`;
    const filePath = path.join(dir, fileName);

    fs.mkdirSync(dir, { recursive: true });

    if (!fs.existsSync(filePath)) {
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(filePath, buffer);
    }

    return publicPath(filePath);
  } catch (error) {
    console.log("No se pudo descargar archivo:", fileUrl);
    return "";
  }
}

function getImageFromElement($, element, baseUrl) {
  const img = $(element).find("img").first();

  const src =
    img.attr("data-full-size-image-url") ||
    img.attr("data-src") ||
    img.attr("data-original") ||
    img.attr("src") ||
    "";

  return absoluteUrl(src, baseUrl);
}

/**
 * IMPORTANTE:
 * En V2 NO usamos toda la descripción de la página para detectar varietal,
 * porque muchas páginas traen textos relacionados y eso podía mandar Malbec/Merlot
 * incorrectamente a Blend.
 *
 * Regla:
 * 1) Si el NOMBRE dice Blend / Corte / Assemblage => Blend.
 * 2) Si no, se detecta el varietal por el NOMBRE del producto.
 * 3) Si no detecta nada, queda "Sin varietal".
 */
function detectVarietal(productName = "") {
  const text = normalize(productName);

  if (
    /\bblend\b/.test(text) ||
    /\bcorte\b/.test(text) ||
    /\bassemblage\b/.test(text) ||
    /\bfield blend\b/.test(text)
  ) return "Blend";

  const rules = [
    ["Cabernet Sauvignon", ["cabernet sauvignon"]],
    ["Cabernet Franc", ["cabernet franc"]],
    ["Petit Verdot", ["petit verdot", "petit-verdot"]],
    ["Pinot Noir", ["pinot noir"]],
    ["Sauvignon Blanc", ["sauvignon blanc"]],
    ["Malbec", ["malbec"]],
    ["Merlot", ["merlot"]],
    ["Bonarda", ["bonarda"]],
    ["Syrah", ["syrah", "shiraz"]],
    ["Tannat", ["tannat"]],
    ["Tempranillo", ["tempranillo"]],
    ["Sangiovese", ["sangiovese"]],
    ["Chardonnay", ["chardonnay"]],
    ["Torrontés", ["torrontes"]],
    ["Chenin", ["chenin"]],
    ["Semillón", ["semillon"]],
    ["Viognier", ["viognier"]],
    ["Rosado", ["rose", "rosado", "rosé"]],
    ["Espumante", ["espumante", "sparkling", "champagne"]],
    ["Destilado", ["gin", "whisky", "vodka", "ron", "grappa", "cognac", "brandy", "licor"]],
  ];

  for (const [label, keywords] of rules) {
    if (keywords.some((keyword) => text.includes(keyword))) return label;
  }

  return "Sin varietal";
}

function findNextPageUrl($, currentUrl) {
  const selectors = [
    'a[rel="next"]',
    ".pagination .next a",
    ".pagination-next a",
    "a.next",
    "li.next a",
  ];

  for (const selector of selectors) {
    const href = $(selector).first().attr("href");
    if (href) return absoluteUrl(href, currentUrl);
  }

  const textCandidates = $("a").filter((_, a) => {
    const txt = normalize($(a).text());
    return txt === "siguiente" || txt.includes("siguiente") || txt === "next";
  });

  const href = textCandidates.first().attr("href");
  return href ? absoluteUrl(href, currentUrl) : "";
}

function extractBrandLinks($, pageUrl) {
  const map = new Map();

  const brandSelectors = [
    ".brand",
    ".brand-item",
    ".manufacturer",
    ".manufacturer-item",
    ".brand-products",
    ".brands a",
    "#brands a",
    ".page-content a",
    "main a",
  ];

  for (const selector of brandSelectors) {
    $(selector).each((_, el) => {
      const linkEl = $(el).is("a") ? $(el) : $(el).find("a").first();
      const href = linkEl.attr("href");
      if (!href) return;

      const url = absoluteUrl(href, pageUrl);
      const rawName =
        cleanText(linkEl.attr("title")) ||
        cleanText($(el).find("img").attr("alt")) ||
        cleanText(linkEl.text()) ||
        cleanText($(el).text());

      const logo = getImageFromElement($, el, pageUrl);

      if (!rawName || rawName.length < 2) return;

      const n = normalize(rawName);
      const lowerUrl = url.toLowerCase();

      const looksLikeBrand =
        lowerUrl.includes("manufacturer") ||
        lowerUrl.includes("bodega") ||
        lowerUrl.includes("marca") ||
        lowerUrl.includes("brand") ||
        selector.includes("brand") ||
        selector.includes("manufacturer");

      const bad =
        n.includes("inicio") ||
        n.includes("contacto") ||
        n.includes("login") ||
        n.includes("carrito") ||
        n.includes("catalogo");

      if (!looksLikeBrand && selector === "main a") return;
      if (bad) return;

      const key = slugify(rawName);
      if (!map.has(key)) {
        map.set(key, {
          nombre: rawName,
          url,
          logo_original_url: logo,
        });
      }
    });
  }

  return Array.from(map.values());
}

function extractProductsFromBrandPage($, pageUrl) {
  const products = [];
  const seen = new Set();

  const productSelectors = [
    ".product-miniature",
    ".js-product-miniature",
    ".product",
    "article.product-miniature",
    ".product-container",
    ".thumbnail-container",
  ];

  for (const selector of productSelectors) {
    $(selector).each((_, el) => {
      const item = $(el);

      const linkEl =
        item.find(".product-title a").first().length ? item.find(".product-title a").first() :
        item.find("h2 a").first().length ? item.find("h2 a").first() :
        item.find("h3 a").first().length ? item.find("h3 a").first() :
        item.find("a").first();

      const href = linkEl.attr("href");
      const name =
        cleanText(linkEl.attr("title")) ||
        cleanText(item.find(".product-title").text()) ||
        cleanText(item.find("h2").text()) ||
        cleanText(item.find("h3").text()) ||
        cleanText(linkEl.text());

      if (!href || !name) return;

      const url = absoluteUrl(href, pageUrl);
      const key = url || slugify(name);
      if (seen.has(key)) return;
      seen.add(key);

      products.push({
        nombre: name,
        url,
        imagen_original_url: getImageFromElement($, item, pageUrl),
      });
    });
  }

  return products;
}

async function scrapeProductDetail(product) {
  try {
    const html = await fetchHtml(product.url);
    const $ = cheerio.load(html);

    const name =
      cleanText($("h1").first().text()) ||
      product.nombre;

    const image =
      $("meta[property='og:image']").attr("content") ||
      $(".product-cover img").attr("data-full-size-image-url") ||
      $(".product-cover img").attr("data-src") ||
      $(".product-cover img").attr("src") ||
      product.imagen_original_url;

    const imageUrl = image ? absoluteUrl(image, product.url) : "";

    return {
      nombre: name,
      varietal: detectVarietal(name),
      imagen_original_url: imageUrl,
    };
  } catch (error) {
    return {
      nombre: product.nombre,
      varietal: detectVarietal(product.nombre),
      imagen_original_url: product.imagen_original_url,
    };
  }
}

async function scrapeBrandProducts(brand, brandDir) {
  let currentUrl = brand.url;
  let page = 1;
  const products = [];
  const seenProducts = new Set();
  const seenPages = new Set();

  while (currentUrl && page <= MAX_PAGES_PER_BODEGA && products.length < MAX_PRODUCTS_PER_BODEGA) {
    console.log(`  Página ${page}: ${currentUrl}`);

    const html = await fetchHtml(currentUrl);
    const $ = cheerio.load(html);

    const pageProducts = extractProductsFromBrandPage($, currentUrl);

    for (const product of pageProducts) {
      if (products.length >= MAX_PRODUCTS_PER_BODEGA) break;
      if (seenProducts.has(product.url)) continue;
      seenProducts.add(product.url);

      console.log(`    Producto: ${product.nombre}`);
      const detail = await scrapeProductDetail(product);

      const varietalSlug = slugify(detail.varietal || "sin-varietal");
      const productImageDir = path.join(brandDir, varietalSlug);
      const localImage = await downloadFile(
        detail.imagen_original_url,
        productImageDir,
        detail.nombre
      );

      products.push({
        nombre: detail.nombre,
        varietal: detail.varietal,
        imagen_url: localImage,
      });
    }

    const nextUrl = findNextPageUrl($, currentUrl);
    if (!nextUrl || nextUrl === currentUrl || seenPages.has(nextUrl)) break;

    seenPages.add(nextUrl);
    currentUrl = nextUrl;
    page += 1;
  }

  return products;
}

async function main() {
  console.log("Buscando bodegas...");
  console.log(`URL: ${START_URL}`);

  const html = await fetchHtml(START_URL);
  const $ = cheerio.load(html);

  let brands = extractBrandLinks($, START_URL);

  if (!brands.length) {
    console.error("No se detectaron bodegas. Hay que ajustar selectores según el HTML real.");
    process.exit(1);
  }

  brands = brands.slice(0, MAX_BODEGAS);

  console.log(`Bodegas detectadas: ${brands.length}`);

  const result = [];
  const flatProducts = [];

  for (const brand of brands) {
    console.log("----------------------------------------");
    console.log(`Bodega: ${brand.nombre}`);

    const brandSlug = slugify(brand.nombre);
    const brandDir = path.join(BODEGAS_ROOT, brandSlug);
    fs.mkdirSync(brandDir, { recursive: true });

    const localLogo = await downloadFile(
      brand.logo_original_url,
      brandDir,
      `${brand.nombre} logo`,
      "logo"
    );

    const products = await scrapeBrandProducts(brand, brandDir);

    const cleanBrand = {
      nombre: brand.nombre,
      logo_url: localLogo,
      productos: products,
    };

    result.push(cleanBrand);

    for (const product of products) {
      flatProducts.push({
        bodega: brand.nombre,
        bodega_logo_url: localLogo,
        nombre: product.nombre,
        varietal: product.varietal,
        imagen_url: product.imagen_url,
      });
    }

    fs.writeFileSync(OUTPUT_BODEGAS, JSON.stringify(result, null, 2), "utf-8");
    fs.writeFileSync(OUTPUT_FLAT, JSON.stringify(flatProducts, null, 2), "utf-8");

    console.log(`  Productos guardados: ${products.length}`);
  }

  console.log("----------------------------------------");
  console.log("Listo.");
  console.log(`Archivo bodegas: ${OUTPUT_BODEGAS}`);
  console.log(`Archivo productos plano: ${OUTPUT_FLAT}`);
  console.log(`Carpeta de bodegas: ${BODEGAS_ROOT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
