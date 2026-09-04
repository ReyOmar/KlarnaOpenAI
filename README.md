# Caso Klarna - Chat con Enrutamiento de IA + Sistema de Alertas

> **Prototipo funcional** basado en el caso real de Klarna × OpenAI

##  Nota importante sobre datos y supuestos

Este prototipo se basa en el caso real de Klarna (2024), pero incluye **supuestos razonables para el proyecto** que no son datos confirmados:

### Datos reales y verificables:
- **2.3 millones** de conversaciones/mes (Klarna, 2024)
- Pricing de referencia de la API de OpenAI (agosto 2026)

### Supuestos del proyecto:
- Klarna **no ha publicado** qué modelo de IA usa internamente
- El presupuesto de **$20,000 USD/mes**
- Los promedios de **800 tokens de entrada / 400 de salida** son estimaciones razonables

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React + TypeScript (Vite) |
| Backend | Express + TypeScript |
| Base de datos | PostgreSQL 18 + Prisma ORM |
| IA | API de OpenAI (gpt-4o como "Terra", gpt-4o-mini como "Luna") |
| Gráficos | Recharts |

## Cómo ejecutar

```bash
# 1. Backend
cd backend
npm install
npx prisma migrate dev
npm run db:seed
npm run dev

# 2. Frontend (otra terminal)
cd frontend
npm install
npm run dev
```

- **Chat**: http://localhost:5173
- **Dashboard**: http://localhost:5173/admin
- **API**: http://localhost:3001/api/health

## Arquitectura

El sistema implementa un **modelo Stock & Flow** para controlar el consumo de créditos:

```
C(t+1) = max(C(t) + R - U(t), 0)
```

### Router de decisión en cascada:
1. **¿Handoff?** → Detecta disputas, fraude, bloqueos, peticiones explícitas → escala a humano
2. **¿Terra o Luna?** → Consultas complejas → Terra (capaz); simples → Luna (económica)

### Endpoints API:
- `POST /api/mensajes` — Chat con router inteligente
- `GET /api/saldo` — Balance actual y proyección
- `GET /api/saldo/historial` — Serie temporal 30 días
- `GET /api/alertas` — Sistema de alertas
- `GET /api/handoffs` — Escalamientos
- `GET /api/modelos/distribucion` — Terra vs Luna
- `GET/PUT /api/configuracion` — Parámetros editables
