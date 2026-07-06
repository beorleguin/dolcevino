export type Product = {
  id: string;
  nombre: string;
  bodega: string;
  varietal: string;
  categoria: 'Vinos' | 'Espumantes' | 'Delicatessen' | 'Regalos';
  precio: number;
  destacado: boolean;
  imagen: string;
};

export const WHATSAPP_NUMBER = '5492612434819';

export const initialProducts: Product[] = [
  { id: '1', nombre: 'Golden Reserve Malbec', bodega: 'Trivento', varietal: 'Malbec', categoria: 'Vinos', precio: 18500, destacado: true, imagen: '/assets/wine-1.svg' },
  { id: '2', nombre: 'Malbec Argentino', bodega: 'Catena Zapata', varietal: 'Malbec', categoria: 'Vinos', precio: 28900, destacado: true, imagen: '/assets/wine-2.svg' },
  { id: '3', nombre: 'Luca Malbec', bodega: 'Luca', varietal: 'Malbec', categoria: 'Vinos', precio: 17200, destacado: true, imagen: '/assets/wine-3.svg' },
  { id: '4', nombre: 'Reserve Cabernet Sauvignon', bodega: 'Salentein', varietal: 'Cabernet Sauvignon', categoria: 'Vinos', precio: 19800, destacado: true, imagen: '/assets/wine-4.svg' },
  { id: '5', nombre: 'Brut Nature', bodega: 'Rutini', varietal: 'Espumante', categoria: 'Espumantes', precio: 23500, destacado: false, imagen: '/assets/wine-2.svg' },
  { id: '6', nombre: 'Box Premium', bodega: 'Dolce Vino', varietal: 'Regalo', categoria: 'Regalos', precio: 32000, destacado: false, imagen: '/assets/wine-1.svg' }
];

export const bodegasIniciales = ['Trivento', 'Catena Zapata', 'Luca', 'Salentein', 'Rutini', 'Dolce Vino'];

export const bodegaLogos = [
  '/assets/bodegas/selected/trivento.png',
  '/assets/bodegas/selected/las-perdices.png',
  '/assets/bodegas/selected/atamisque.png',
  '/assets/bodegas/selected/catena-zapata.png',
  '/assets/bodegas/selected/escorihuela-gascon.png',
  '/assets/bodegas/selected/clos-de-los-siete.png',
  '/assets/bodegas/selected/santa-julia.png',
  '/assets/bodegas/selected/finca-la-celia.png',
  '/assets/bodegas/selected/sophenia.png',
  '/assets/bodegas/selected/susana-balbo.png',
  '/assets/bodegas/selected/bressia.png'
];


export function formatPrice(value: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);
}

export function whatsappLink(productName: string) {
  const text = `Hola quería saber si contaban con stock de este vino "${productName}". Gracias.`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}
