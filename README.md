# Dolce Vino Next

Sitio catálogo para Dolce Vino con dashboard, carrusel de bodegas e importador privado inicial.

## Instalar

```bash
npm install
npm run dev
```

Abrir:

```txt
http://localhost:3000
```

Dashboard demo:

```txt
http://localhost:3000/dashboard
Clave: admin123
```

Importador privado:

```txt
http://localhost:3000/dashboard/importador
```

## Importador privado desde navegador

Pegá una URL de categoría o producto y presioná **Buscar productos**.

El importador intenta traer:

- nombre
- bodega
- categoría
- varietal
- tipo
- notas / descripción
- características técnicas
- imagen

Ignora:

- precios
- stock
- carrito
- datos de compra

La pantalla pública no muestra ninguna referencia a la fuente externa.

## Importador con descarga de imágenes propias

Para descargar imágenes dentro del proyecto, usá el script de terminal:

```bash
node scripts/scrape-products.js "https://URL-DE-CATEGORIA-O-PRODUCTO" 1000 30
```

También podés usar:

```bash
npm run scrape:products -- "https://URL-DE-CATEGORIA-O-PRODUCTO" 1000 30
```

El segundo número es el límite de productos y el tercero es la cantidad máxima de páginas a recorrer.

Para una categoría grande, usá por ejemplo:

```bash
node scripts/scrape-products.js "https://URL-DE-CATEGORIA" 1000 30
```

El script ahora detecta el botón **Siguiente** y recorre la paginación completa hasta llegar al límite indicado.

El script genera:

```txt
data/imported-products.json
public/products/imported/
```

En el JSON, las imágenes quedan apuntando a rutas propias del proyecto, por ejemplo:

```txt
/products/imported/nombre-del-vino-a1b2c3d4.jpg
```

## Próximo paso recomendado

Cuando validemos que el scraper trae bien la información, conviene pasar imágenes a:

- Supabase Storage, o
- Cloudinary

Y guardar los productos en Supabase Database para que el dashboard sea real y multiusuario.

## V18 - CRM y catálogo corregidos

Cambios incluidos:

- CRM con menú lateral fijo, botón para contraer y botón de cerrar sesión.
- Filtros globales debajo de KPIs: bodega, vino y varietal.
- Búsqueda con botón de lupa/Buscar.
- Si se filtra por bodega o búsqueda, la tabla ocupa todo el ancho y se oculta el listado lateral de bodegas.
- Tabla con paginación de 5 vinos por página.
- Filtro interno dentro de la tabla.
- Tarjetas públicas rediseñadas con fondo blanco para la botella.
- Se evita mostrar duplicados generados por imágenes `-transparent` o `-clean`.
- El script `build:bodegas` ahora ignora imágenes transparentes generadas y toma las originales.

Para regenerar catálogo desde carpetas:

```bash
npm run build:bodegas
```

Para levantar el sitio:

```bash
npm install
npm run dev
```
