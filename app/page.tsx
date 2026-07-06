'use client';

import { useEffect, useMemo, useState } from 'react';
import { Product, bodegaLogos, initialProducts, whatsappLink } from '@/lib/data';
import {
  BODEGAS_ADDED_KEY,
  BODEGAS_EDITS_KEY,
  BODEGAS_STATUS_KEY,
  applyBodegasEdits,
  applyBodegasStatus,
  bodegasCatalog,
  getEnabledBodegas,
  mergeAddedBodegas,
} from '@/lib/bodegas';
import type { BodegaCatalogItem, BodegasAdded, BodegasEdits, BodegasStatus } from '@/lib/bodegas';

const STORAGE_KEY = 'dolce-vino-products-v1';
const PAGE_SIZE = 10;

type DisplayProduct = Product & {
  tamano?: string;
  caracteristicas?: string;
  fromBodegaCatalog?: boolean;
};

function getManualProducts(): Product[] {
  if (typeof window === 'undefined') return initialProducts;
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : initialProducts;
}

function readJsonStorage<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  const saved = localStorage.getItem(key);
  return saved ? (JSON.parse(saved) as T) : null;
}

function cleanKey(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/-transparent(?=\.)/g, '')
    .replace(/\.(png|jpg|jpeg|webp)$/i, '')
    .replace(/[^a-z0-9]+/g, '-');
}

function normalizeSearch(value = '') {
  return String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function bestImage(image = '') {
  return image.replace(/-transparent(?=\.(png|jpg|jpeg|webp)$)/i, '');
}

function isValidBodegaName(name = '') {
  return !name.toLowerCase().includes('sol y vino');
}

function bodegaCatalogToProducts(catalog: BodegaCatalogItem[]): DisplayProduct[] {
  const rows: DisplayProduct[] = [];

  catalog.filter((bodega) => isValidBodegaName(bodega.nombre)).forEach((bodega) => {
    bodega.productos.forEach((product, index) => {
      const category = product.varietal?.toLowerCase().includes('espumante') ? 'Espumantes' : 'Vinos';
      rows.push({
        id: product.id,
        nombre: product.nombre,
        bodega: bodega.nombre,
        varietal: product.varietal || 'Sin varietal',
        categoria: category,
        precio: Number(product.precio || 0),
        destacado: product.recomendado ?? index < 3,
        imagen: bestImage(product.imagen_url),
        tamano: product.tamano || '750 ml',
        caracteristicas: product.caracteristicas || '',
        fromBodegaCatalog: true,
      });
    });
  });

  const unique = new Map<string, DisplayProduct>();
  for (const product of rows) {
    const key = `${cleanKey(product.bodega)}-${cleanKey(product.nombre)}-${cleanKey(product.varietal)}`;
    if (!unique.has(key)) unique.set(key, product);
  }

  return Array.from(unique.values());
}

function FeatureIcon({ type }: { type: 'wine' | 'basket' | 'truck' | 'store' }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  if (type === 'wine') return <svg viewBox="0 0 48 48" aria-hidden="true"><path {...common} d="M16 5h16v14c0 6-3.7 10-8 10s-8-4-8-10V5Z"/><path {...common} d="M24 29v12M17 41h14M16 15h16"/></svg>;
  if (type === 'basket') return <svg viewBox="0 0 48 48" aria-hidden="true"><path {...common} d="M9 19h30l-3 21H12L9 19Z"/><path {...common} d="M17 19c0-6 3-10 7-10s7 4 7 10M15 27h18M14 34h20"/><path {...common} d="M20 12h8"/></svg>;
  if (type === 'truck') return <svg viewBox="0 0 48 48" aria-hidden="true"><path {...common} d="M5 14h24v20H5V14Z"/><path {...common} d="M29 21h7l7 8v5H29V21Z"/><path {...common} d="M13 39a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM36 39a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/><path {...common} d="M29 34H17"/></svg>;
  return <svg viewBox="0 0 48 48" aria-hidden="true"><path {...common} d="M8 19h32v23H8V19Z"/><path {...common} d="M5 19h38L39 8H9L5 19Z"/><path {...common} d="M15 19v23M33 19v23M19 30h10v12H19V30Z"/><path {...common} d="M12 8v11M20 8v11M28 8v11M36 8v11"/></svg>;
}

function ProductImage({ product }: { product: DisplayProduct }) {
  return <div className="bottle-stage"><img src={product.imagen} alt={product.nombre} loading="lazy" /></div>;
}

function ProductCard({ product, compact = false }: { product: DisplayProduct; compact?: boolean }) {
  return (
    <article className={`wine-card ${compact ? 'featured' : ''}`}>
      <ProductImage product={product} />
      <div className="wine-card-body">
        <small>{product.bodega}</small>
        <h3>{product.nombre}</h3>
        <p>{product.varietal} · {product.tamano || '750 ml'}</p>
        <a className="whatsapp-text" href={whatsappLink(product.nombre)} target="_blank" rel="noreferrer">Consultar stock</a>
      </div>
    </article>
  );
}

export default function Home() {
  const [manualProducts, setManualProducts] = useState<Product[]>(initialProducts);
  const [enabledBodegas, setEnabledBodegas] = useState<BodegaCatalogItem[]>(() => getEnabledBodegas(mergeAddedBodegas(bodegasCatalog)));
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todos');
  const [varietal, setVarietal] = useState('Todos');
  const [bodega, setBodega] = useState('Todos');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setManualProducts(getManualProducts());
    const savedStatus = readJsonStorage<BodegasStatus>(BODEGAS_STATUS_KEY);
    const savedEdits = readJsonStorage<BodegasEdits>(BODEGAS_EDITS_KEY);
    const added = readJsonStorage<BodegasAdded>(BODEGAS_ADDED_KEY);
    const withAdded = mergeAddedBodegas(bodegasCatalog, added);
    const editedCatalog = applyBodegasEdits(withAdded, savedEdits);
    const statusCatalog = applyBodegasStatus(editedCatalog, savedStatus);
    setEnabledBodegas(getEnabledBodegas(statusCatalog));
  }, []);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, category, varietal, bodega]);

  const realProducts = useMemo(() => bodegaCatalogToProducts(enabledBodegas), [enabledBodegas]);
  const products: DisplayProduct[] = realProducts.length ? realProducts : manualProducts;
  const varietales = useMemo(() => ['Todos', ...Array.from(new Set(products.map(p => p.varietal))).sort()], [products]);
  const bodegas = useMemo(() => ['Todos', ...Array.from(new Set(products.map(p => p.bodega).filter(isValidBodegaName))).sort()], [products]);
  const destacados = (products.filter(p => p.destacado).length >= 4 ? products.filter(p => p.destacado) : products).slice(0, 4);
  const carouselLogos = enabledBodegas.length
    ? enabledBodegas.filter(b => isValidBodegaName(b.nombre)).map(b => b.logo_gold || b.logo_white || b.logo_clean).filter(Boolean).slice(0, 40)
    : bodegaLogos;

  const filtered = products.filter(p =>
    (category === 'Todos' || p.categoria === category) &&
    (varietal === 'Todos' || p.varietal === varietal) &&
    (bodega === 'Todos' || p.bodega === bodega) &&
    normalizeSearch(`${p.nombre} ${p.bodega} ${p.varietal}`).includes(normalizeSearch(query))
  );

  const visibleProducts = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  function downloadCatalog() {
    const rows = [['Nombre','Bodega','Varietal','Tamaño'], ...filtered.map(p => [p.nombre,p.bodega,p.varietal,p.tamano || ''])];
    const csv = rows.map(r => r.map(c => `"${String(c).replaceAll('"','""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'catalogo-dolce-vino.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return <>
    <nav className="nav">
      <div className="nav-inner">
        <button className="hamburger" type="button" aria-label="Abrir menú" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(v => !v)}><span/><span/><span/></button>
        <div className="nav-links"><a className="active" href="#inicio">Inicio</a><a href="#catalogo">Vinos</a><a href="#categorias">Espumantes</a><a href="#categorias">Delicatessen</a></div>
        <a className="brand-logo" href="#inicio" aria-label="Dolce Vino"><img src="/assets/logo_dolce_vino.png" alt="Dolce Vino" /></a>
        <div className="nav-links right"><a href="#catalogo">Catálogo</a><a href="#contacto">Contacto</a><a className="login-link" href="/dashboard">Inicio sesión</a></div>
      </div>
      <div className={`mobile-menu ${mobileMenuOpen ? 'open' : ''}`}><a className="active" href="#inicio">Inicio</a><a href="#catalogo">Vinos</a><a href="#categorias">Espumantes</a><a href="#categorias">Delicatessen</a><a href="#catalogo">Catálogo</a><a href="#contacto">Contacto</a><a className="login-link" href="/dashboard">Inicio sesión</a></div>
    </nav>

    <header id="inicio" className="hero">
      <div className="hero-shade"/>
      <div className="container hero-layout">
        <div className="hero-content">
          <div className="eyebrow">Almacén de vinos</div>
          <h1>Dolce Vino</h1>
          <span className="title-line"/>
          <p>Una cuidada selección de vinos y espumantes de las mejores bodegas, junto a delicatessen premium para los paladares más exigentes.</p>
          <a className="btn" href="#catalogo">Descubrí nuestra selección <span>→</span></a>
        </div>
      </div>
    </header>

    <section className="features"><div className="container features-grid"><div className="feature"><div className="icon"><FeatureIcon type="wine" /></div><div><b>Selección premium</b><p>Vinos de las mejores bodegas</p></div></div><div className="feature"><div className="icon"><FeatureIcon type="basket" /></div><div><b>Delicatessen exclusivo</b><p>Productos gourmet seleccionados</p></div></div><div className="feature"><div className="icon"><FeatureIcon type="truck" /></div><div><b>Envíos a domicilio</b><p>Rápidos y seguros</p></div></div><div className="feature"><div className="icon"><FeatureIcon type="store" /></div><div><b>Atención personalizada</b><p>Asesoramiento de expertos</p></div></div></div></section>

    <section className="showcase"><div className="container showcase-stack">
      <div className="winery-carousel" aria-label="Bodegas"><div className="logo-fade"><div className="marquee-track logo-track">{[...carouselLogos, ...carouselLogos].map((logo, index) => <img className="winery-logo-img" src={logo} alt="Logo de bodega" key={`${logo}-${index}`} />)}</div></div></div>

      <div className="recommended-block"><div className="section-head compact"><div><div className="eyebrow small">Selección destacada</div><h2>Vinos <span>recomendados</span></h2></div><a className="text-link" href="#catalogo">Ver todos →</a></div><div className="featured-grid">{destacados.map(product => <ProductCard product={product} compact key={product.id}/>)}</div></div>

      <div id="categorias" className="categories-block"><div className="section-head compact"><div><h2>Explorá nuestras <span>categorías</span></h2></div></div><div className="categories"><div className="cat">Vinos</div><div className="cat">Espumantes</div><div className="cat">Delicatessen</div><div className="cat">Regalos</div></div></div>
    </div></section>

    <main id="catalogo" className="section catalog"><div className="container"><div className="section-head"><div><div className="eyebrow">Catálogo actualizado</div><h2>Productos <span>disponibles</span></h2><p className="section-subtitle">Mostramos los primeros 10 productos. Usá los filtros o tocá “Ver más” para seguir explorando.</p></div><button className="btn" onClick={downloadCatalog}>Descargar catálogo</button></div><div className="filters filters-4"><input placeholder="Buscar vino, bodega o varietal" value={query} onChange={e => setQuery(e.target.value)} /><select value={bodega} onChange={e => setBodega(e.target.value)}>{bodegas.map(v => <option key={v}>{v}</option>)}</select><select value={category} onChange={e => setCategory(e.target.value)}><option>Todos</option><option>Vinos</option><option>Espumantes</option><option>Delicatessen</option><option>Regalos</option></select><select value={varietal} onChange={e => setVarietal(e.target.value)}>{varietales.map(v => <option key={v}>{v}</option>)}</select></div><div className="products-grid">{visibleProducts.map(p => <ProductCard product={p} key={p.id}/>)}</div>{hasMore && <div className="load-more-wrap"><button className="btn" onClick={() => setVisibleCount(v => v + PAGE_SIZE)}>Ver más productos</button></div>}</div></main>

    <section id="contacto" className="section contact-section"><div className="container contact-grid"><div><div className="eyebrow">Contacto</div><h2>Visitá Dolce Vino</h2><p>Te esperamos para asesorarte y ayudarte a elegir el vino ideal para cada momento.</p><div className="contact-info"><b>Ubicación</b><span>Mendoza, Argentina</span><b>Teléfono / WhatsApp</b><span>+54 9 261 243 4819</span><b>Atención</b><span>Consultas por stock, bodegas y recomendaciones.</span></div></div><form className="contact-form"><label>Nombre<input placeholder="Tu nombre" /></label><label>Teléfono<input placeholder="Tu WhatsApp" /></label><label>Consulta<textarea placeholder="Contanos qué vino, bodega o varietal estás buscando" /></label><button className="btn" type="button">Enviar consulta</button></form></div></section>

    <footer className="footer"><div className="container footer-inner"><img src="/assets/logo_dolce_vino.png" alt="Dolce Vino"/><div><b>Dolce Vino</b><p>Bebidas & Delicatessen · Catálogo de vinos y productos seleccionados.</p></div></div></footer>
  </>;
}
