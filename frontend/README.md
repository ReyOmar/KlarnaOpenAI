# Frontend — Chat y Dashboard

Aplicación React + TypeScript (Vite). Las instrucciones completas están en el [README principal](../README.md).

```bash
npm install
npm run dev     # http://localhost:5173 (redirige /api al backend en :3001)
npm run build   # genera dist/, que el backend sirve en producción
npm run lint
```

Si el frontend se despliega en un dominio distinto al backend, define `VITE_API_URL` antes de compilar
(ej. `VITE_API_URL=https://mi-backend.onrender.com`).
