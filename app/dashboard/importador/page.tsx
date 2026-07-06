'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Product } from '@/lib/data';

const STORAGE_KEY = 'dolce-vino-products-v1';

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

function normalizeCategory(value: string): Product['categoria'] {
  if (/espumante/i.test(value)) return 'Espumantes';
  if (/delicatessen/i.test(value)) return 'Delicatessen';
  return 'Vinos';
}

function loadProducts(): Product[] {
  if (typeof window === 'undefined') return [];
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : [];
}

function saveProducts(products: Product[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
}

export default function ImportadorPage() {
  const [url, setUrl] = useState('');
  const [limit, setLimit] = useState(100);
  const [maxPages, setMaxPages] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [products, setProducts] = useState<ImportedProduct[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});

  const selectedCount = useMemo(() => Object.values(selected).filter(Boolean).length, [selected]);

  async function scrape() {
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    setProducts([]);
    setSelected({});

    try {
      const response = await fetch('/api/private-import/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, limit, maxPages })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo importar');
      setProducts(data.products || []);
      const initialSelected: Record<number, boolean> = {};
      (data.products || []).forEach((_: ImportedProduct, index: number) => { initialSelected[index] = true; });
      setSelected(initialSelected);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  }

  function importSelected() {
    const current = loadProducts();
    const selectedProducts = products
      .filter((_, index) => selected[index])
      .map((item): Product => ({
        id: crypto.randomUUID(),
        nombre: item.nombre,
        bodega: item.bodega || 'Sin bodega',
        varietal: item.varietal || item.tipo || 'Sin varietal',
        categoria: normalizeCategory(item.categoria),
        precio: 0,
        destacado: false,
        imagen: item.imagen_original_url || '/assets/wine-1.svg'
      }));

    saveProducts([...selectedProducts, ...current]);
    alert(`Productos importados: ${selectedProducts.length}. Luego cargá precio e imagen propia/storage definitivo desde el dashboard.`);
  }

  function downloadJson() {
    const data = products.filter((_, index) => selected[index]);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = 'productos-importados-dolce-vino.json';
    a.click();
    URL.revokeObjectURL(objectUrl);
  }

  return <main className="admin"><div className="container">
    <div className="section-head">
      <div>
        <div className="eyebrow">Dolce Vino</div>
        <h2>Importador privado</h2>
      </div>
      <div className="actions">
        <Link className="btn" href="/dashboard">Volver al dashboard</Link>
        <Link className="btn" href="/">Ver sitio</Link>
      </div>
    </div>

    <section className="panel">
      <h3>Importar vinos, bodegas, varietales, notas e imágenes</h3>
      <p style={{color:'#b9b2a8',maxWidth:860}}>
        Pegá una URL de categoría o producto. Si es categoría, el importador recorre la paginación usando el botón Siguiente. Ignora precios, stock y carrito. En el sitio público no se muestra ninguna fuente externa.
        Para guardar las imágenes como archivos propios, usá el script de terminal incluido en <b>scripts/scrape-products.js</b>.
      </p>
      <div className="api-search">
        <input placeholder="https://..." value={url} onChange={e => setUrl(e.target.value)} />
        <input title="Límite de productos" type="number" min={1} max={300} value={limit} onChange={e => setLimit(Number(e.target.value))} style={{maxWidth:120}} />
        <input title="Máximo de páginas" type="number" min={1} max={30} value={maxPages} onChange={e => setMaxPages(Number(e.target.value))} style={{maxWidth:120}} />
        <button className="primary" type="button" onClick={scrape}>{loading ? 'Buscando...' : 'Buscar productos'}</button>
      </div>
      {error && <p style={{color:'#ffb5b5'}}>{error}</p>}
    </section>

    {products.length > 0 && <section className="panel">
      <div className="section-head compact">
        <div><h3>Resultados detectados</h3><p style={{color:'#b9b2a8'}}>{products.length} productos encontrados · {selectedCount} seleccionados</p></div>
        <div className="actions"><button className="btn" onClick={downloadJson}>Descargar JSON</button><button className="primary" onClick={importSelected}>Importar seleccionados</button></div>
      </div>

      <div className="import-grid">
        {products.map((product, index) => <article className="import-card" key={`${product.nombre}-${index}`}>
          <label className="import-check"><input type="checkbox" checked={!!selected[index]} onChange={e => setSelected({...selected, [index]: e.target.checked})} /> Seleccionar</label>
          {product.imagen_original_url ? <img src={product.imagen_original_url} alt={product.nombre} /> : <div className="import-placeholder">Sin imagen</div>}
          <div className="import-body">
            <small>{product.bodega || 'Bodega no detectada'}</small>
            <h3>{product.nombre}</h3>
            <p>{product.varietal || product.tipo || 'Sin varietal'} · {product.categoria}</p>
            {product.notas && <p className="import-notes">{product.notas.slice(0, 220)}{product.notas.length > 220 ? '...' : ''}</p>}
          </div>
        </article>)}
      </div>
    </section>}
  </div></main>;
}
