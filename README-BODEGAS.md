# Dolce Vino - Flujo de bodegas y vinos

Esta versión agrega el flujo para trabajar con bodegas, logos dorados y vinos agrupados por varietal.

## 1. Instalar dependencias

```bash
npm install
```

Si ya tenías el proyecto instalado, ejecutá igualmente:

```bash
npm install cheerio sharp
```

## 2. Estructura esperada

Las bodegas deben estar en:

```txt
public/products/bodegas/
  achaval-ferrer/
    logo.jpg
    logo-gold.png
    logo-white.png
    logo-clean.png
    malbec/
      vino-1.jpg
    merlot/
      vino-2.jpg
    blend/
      vino-3.jpg
```

## 3. Scrapear bodegas

```bash
npm run scrape:bodegas -- "https://solyvinomendoza.com/bodegas"
```

Para probar pocas bodegas:

```bash
node scripts/scrape-bodegas.js "https://solyvinomendoza.com/bodegas" 5 50 10
```

## 4. Normalizar logos

```bash
npm run logos:bodegas
```

Esto busca el archivo `logo.*` dentro de cada carpeta de bodega y genera:

```txt
logo-clean.png
logo-white.png
logo-gold.png
```

## 5. Crear catálogo administrable

```bash
npm run build:bodegas
```

Esto genera:

```txt
data/bodegas-catalog.json
```

con este formato:

```json
{
  "habilitada": true,
  "productos": [
    {
      "habilitado": true
    }
  ]
}
```

Si ya existía el JSON, el script conserva los estados `habilitada` y `habilitado` para no perder tus cambios.

## 6. Dashboard

Entrar a:

```txt
http://localhost:3000/dashboard/bodegas
```

Clave demo:

```txt
admin123
```

Desde ahí podés:

- activar/desactivar bodega completa
- activar/desactivar vino individual
- ver vinos agrupados por varietal

Por ahora los cambios del dashboard se guardan en `localStorage`. Para producción real en Vercel, lo siguiente es pasarlo a Supabase.

## 7. Sitio público

El carrusel superior usa automáticamente los `logo-gold.png` de las bodegas habilitadas cuando existe `data/bodegas-catalog.json`.
