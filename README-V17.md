# Dolce Vino v17

Cambios incluidos:

- Sitio público preparado para mostrar vinos reales desde `data/bodegas-catalog.json`.
- Las tarjetas de vinos tienen fondo claro con transparencia para que se vean mejor las botellas negras.
- Nuevo script para quitar fondo blanco de todas las botellas:

```bash
npm run bottles:clean
```

Ese script recorre:

```txt
public/products/bodegas/**
```

Ignora logos, genera imágenes `-transparent.png` y actualiza `data/bodegas-catalog.json` para usar esas imágenes.

- Dashboard rediseñado como CRM.
- Login rediseñado.
- Eliminada la sección de WineAPI del dashboard principal.
- Tabla de vinos por bodega con columnas:
  - nombre
  - varietal
  - tamaño
  - precio
  - visible
  - acciones
- Modal de edición con imagen, nombre, varietal, tamaño, precio, URL de imagen y características/notas.
- Posibilidad de habilitar/deshabilitar bodega completa o vino individual.

## Instalación

```bash
npm install
npm run dev
```

## Flujo recomendado

1. Scrapear bodegas:

```bash
npm run scrape:bodegas -- "https://solyvinomendoza.com/bodegas"
```

2. Normalizar logos:

```bash
npm run logos:bodegas
```

3. Generar catálogo:

```bash
npm run build:bodegas
```

4. Quitar fondo blanco de botellas:

```bash
npm run bottles:clean
```

5. Iniciar sitio:

```bash
npm run dev
```

Dashboard:

```txt
http://localhost:3000/dashboard
```

Clave demo:

```txt
admin123
```
