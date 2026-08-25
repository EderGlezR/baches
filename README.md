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

### 3. Desarrollo local del proyecto Android (opcional)

Si tienes Android Studio/SDK instalados:

```bash
npm install
npx cap sync android
npx cap open android
```
