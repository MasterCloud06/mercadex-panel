# Mercadex Panel de caja

Panel web (Vite + React) para la caja: revisar y aprobar comprobantes enviados desde la
app de socios, dar acceso a la app (códigos de activación) y configurar los datos de pago.

Usa la API de [mercadex-backend](https://github.com/MasterCloud06/mercadex-backend)
con el usuario administrador.

## Ramas

- `develop`: trabajo diario.
- `main`: producción (Render publica automáticamente).

## Entornos

| Entorno | Archivo | API |
|---|---|---|
| Desarrollo | `.env.development` | `http://127.0.0.1:5189` |
| Producción | `.env.production` | `https://mercadex-api.onrender.com` |

```powershell
npm install
npm run dev          # desarrollo, http://localhost:5173
npm run build        # producción, sale en dist/
```

## Publicación en Render

Static Site conectado a este repositorio (rama `main`):

- Build command: `npm ci && npm run build`
- Publish directory: `dist`

En la API (`mercadex-api`) la variable `MERCADEX_PANEL_ORIGINS` debe incluir la URL
del panel, por ejemplo `https://mercadex-panel.onrender.com`.
