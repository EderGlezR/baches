# Baches

Proyecto para reportar y dar seguimiento a baches en la vía pública.

## Objetivo

Permitir que los ciudadanos reporten baches y que el ayuntamiento les dé seguimiento hasta su reparación.

## Estructura

- `docs/` — la app web (se sirve tal cual vía GitHub Pages y también es el `webDir` de Capacitor).
- `android/` — proyecto nativo generado por Capacitor para compilar el APK.
- `scripts/download-tiles.js` — descarga los tiles offline de la zona metropolitana de Monterrey.
- `.github/workflows/build-apk.yml` — compila el APK en GitHub Actions.

## App offline (APK)

La app funciona sin internet: el mapa usa tiles precargados de Monterrey (`docs/tiles/`), los reportes
creados sin conexión se guardan en el dispositivo y se sincronizan solos a Supabase en cuanto vuelve la señal.

### 1. Descargar los tiles de Monterrey (una sola vez)

1. Crea una cuenta gratuita en [MapTiler](https://www.maptiler.com/) y genera un API key.
2. Corre:
   ```bash
   npm install
   MAPTILER_KEY=tu_api_key node scripts/download-tiles.js
   ```
3. Esto llena `docs/tiles/`. Súbelo al repo (commit + push) para que quede incluido tanto en GitHub Pages como en el próximo build del APK.

### 2. Obtener el APK

Cada push a `main` dispara el workflow **Build APK** en GitHub Actions (o puedes lanzarlo manualmente desde la
pestaña *Actions*). Al terminar, descarga el artifact `baches-debug-apk` desde la ejecución del workflow e
instálalo en un Android (requiere permitir "orígenes desconocidos" al instalar un APK debug).

> El APK es un build debug sin firmar, pensado para instalar y probar directamente. Firmar un release para
> publicarlo en Play Store es un paso aparte, no cubierto todavía.

## App de escritorio (Windows y otros) como PWA

`docs/` es también una Progressive Web App: incluye un service worker (`docs/sw.js`) que precarga
el shell de la app y todos los tiles de Monterrey la primera vez que se visita con internet, para
que funcione completamente offline después (igual que el APK). Los reportes creados sin conexión
usan el mismo outbox de IndexedDB y se sincronizan solos al reconectar.

Para instalarla en una PC con Windows: abre `https://ederglezr.github.io/baches/index.html` en Edge
o Chrome y usa la opción "Instalar" (ícono en la barra de direcciones, o menú ⋮ → "Instalar Baches").
Queda como una app independiente en el menú de inicio, sin necesidad de compilar nada.

> `download-tiles.js` regenera automáticamente `docs/tiles-manifest.json` (la lista que usa el
> service worker para precachear todos los tiles), así que basta con volver a correrlo.

### 3. Desarrollo local del proyecto Android (opcional)

Si tienes Android Studio/SDK instalados:

```bash
npm install
npx cap sync android
npx cap open android
```
