# Caso Klarna — Chat con Enrutamiento de IA + Sistema de Alertas

> **Prototipo académico** basado en el caso real de Klarna × OpenAI (2024). No está afiliado a Klarna.

Chat de atención al cliente para una fintech de pagos que decide, para cada mensaje, si debe **escalar a un agente humano** o qué **modelo de IA** responde (uno capaz, *Terra*, o uno económico, *Luna*). Un **panel de administración** controla el gasto en IA con un modelo *Stock & Flow*, genera alertas cuando el saldo de créditos baja del umbral e incluye un **simulador de escenarios** para probar decisiones de presupuesto y enrutamiento sin afectar la operación.

## Nota sobre datos y supuestos

**Datos reales y verificables**
- Klarna reportó **2,3 millones** de conversaciones en el primer mes de su asistente de IA (Klarna, 2024).
- Pricing de referencia de la API de OpenAI (agosto 2026) para simular costos.

**Supuestos del proyecto**
- Klarna **no ha publicado** qué modelo usa internamente; "Terra" y "Luna" son nombres propios de este proyecto.
- El presupuesto de **USD 20.000/mes**, el saldo inicial de **USD 10.000** y el umbral de **USD 2.000**.
- Los promedios de **800 tokens de entrada / 400 de salida** por conversación.
- El costo se calcula siempre con el pricing de referencia guardado en la base de datos, aunque el proveedor real sea gratuito (por ejemplo Ollama). Así la simulación financiera sigue siendo representativa.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + TypeScript (Vite) |
| Backend | Express 5 + TypeScript |
| Base de datos | PostgreSQL + Prisma ORM |
| IA | Cualquier API compatible con OpenAI: **Ollama (local)**, Groq, Gemini, OpenAI, OpenRouter… |
| Gráficos | Recharts |
| Pruebas | `node:test` + `tsx` (34 pruebas unitarias) |

## Proveedores de IA

El backend usa el SDK de OpenAI apuntando a cualquier API compatible, así que **no depende de OpenAI**. Se elige con `AI_PROVIDER` en `backend/.env`:

| `AI_PROVIDER` | Costo | API key | Terra (por defecto) | Luna (por defecto) |
|---|---|---|---|---|
| `ollama` | Gratis, local | No | `qwen2.5:7b` | `llama3.2:3b` |
| `groq` | Plan gratuito | [console.groq.com](https://console.groq.com/keys) | `qwen/qwen3.8-27b` | `qwen/qwen3.8-27b` |
| `gemini` | Plan gratuito | [aistudio.google.com](https://aistudio.google.com/apikey) | `gemini-3.5-flash` | `gemini-3.5-flash-lite` |
| `openai` | De pago | platform.openai.com | `gpt-4o` | `gpt-4o-mini` |
| `custom` | Depende | Depende | `AI_MODEL_TERRA` | `AI_MODEL_LUNA` |
| `simulado` | Gratis | No | respuestas de ejemplo | respuestas de ejemplo |

### Un proveedor distinto por nivel (configuración recomendada)

Con `AI_PROVIDER_TERRA` y `AI_PROVIDER_LUNA` cada nivel usa su propio proveedor, y **cada uno sirve de respaldo automático del otro**: si Gemini falla o llega a su límite gratuito, Terra responde con Groq, y viceversa. Solo si ambos fallan se pasa a modo simulado.

```
AI_PROVIDER_TERRA=gemini        # consultas complejas → gemini-3.5-flash
AI_PROVIDER_LUNA=groq           # consultas simples   → qwen/qwen3.8-27b
GEMINI_API_KEY=...
GROQ_API_KEY=...
```

Cada proveedor lee su propia clave (`GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`); `AI_API_KEY` se usa como clave genérica. El panel muestra "usando respaldo" cuando entra en acción el proveedor alterno. Para desactivar el respaldo cruzado: `AI_RESPALDO_CRUZADO=false`.

> Groq retiró los modelos Llama 3.x en 2026; su modelo de chat disponible es Qwen 3.8 (en vista previa). Si cambia, ajusta `AI_MODEL_LUNA` o revisa `npm run ia:probar`.

### Otros ajustes

- Los modelos se pueden cambiar con `AI_MODEL_TERRA` y `AI_MODEL_LUNA` (ej. `gemma3:12b`, `mistral`, `qwen3:8b`).
- `custom` sirve para OpenRouter, LM Studio, Mistral, DeepSeek, etc.: define `AI_BASE_URL`, `AI_API_KEY` y los dos modelos.
- Si el proveedor falla (sin créditos, sin red, modelo inexistente), el chat responde en **modo simulado** y lo indica con la etiqueta *"modo demo"*. El dashboard muestra el error en "Proveedor de IA". Para ver el error real en vez del respaldo usa `AI_FALLBACK_SIMULADO=false`.
- Para diagnosticar la conexión: `npm run ia:probar` (en `backend/`). Por cada nivel y su respaldo, verifica que el modelo exista y envía un mensaje de prueba.

### Usar Ollama (local, sin costo)

```bash
# 1. Instalar Ollama desde https://ollama.com/download
# 2. Descargar los modelos
ollama pull qwen2.5:7b
ollama pull llama3.2:3b
# 3. En backend/.env
AI_PROVIDER=ollama
```

Con poca RAM (8 GB) se pueden usar modelos más livianos para ambos niveles, por ejemplo `AI_MODEL_TERRA=llama3.2:3b` y `AI_MODEL_LUNA=llama3.2:1b`.

## Cómo ejecutar en local

Requisitos: Node.js 20 o superior y PostgreSQL.

```bash
# 1. Backend
cd backend
cp .env.example .env        # completar DATABASE_URL y AI_PROVIDER
npm install
npx prisma migrate dev      # crea las tablas
npm run db:seed             # datos de ejemplo (30 días de historial)
npm run dev

# 2. Frontend (otra terminal)
cd frontend
npm install
npm run dev
```

- **Chat**: http://localhost:5173
- **Dashboard**: http://localhost:5173/admin
- **Estado de la API**: http://localhost:3001/api/health (base de datos + proveedor de IA)

El seed se puede ejecutar varias veces: solo crea lo que falta. Al iniciar, el servidor también crea los datos mínimos (modelos, configuración, agentes y usuario demo) si no existen.

### Pruebas

```bash
cd backend
npm test
```

Cubren el router (handoff / Terra / Luna), el modelo Stock & Flow, el cálculo de costos, las alertas, la configuración de proveedores de IA y el simulador (incluidas pruebas de condiciones extremas que validan el modelo).

## Despliegue para pruebas

El backend sirve también el frontend compilado, así que basta **un solo servicio web + una base PostgreSQL**. Desde la raíz:

```bash
npm run build   # instala dependencias, compila frontend y backend
npm start       # aplica migraciones, carga los datos de ejemplo si faltan y arranca el servidor
```

### Render (gratis)

1. Crea una cuenta en [Render](https://render.com) entrando con tu cuenta de GitHub.
2. **New → Blueprint** y elige este repositorio. El archivo `render.yaml` crea la base de datos PostgreSQL y el servicio web (ambos en plan gratuito), con Terra en Gemini y Luna en Groq.
3. Render pedirá `GEMINI_API_KEY` y `GROQ_API_KEY`: pega tus claves y pulsa **Apply**.
4. Espera el primer despliegue (unos 5 a 10 minutos). Los datos de ejemplo se cargan solos al arrancar.
5. Abre la URL del servicio (algo como `https://klarna-openai.onrender.com`) y revisa `/api/health`.

Notas del plan gratuito: el servicio se suspende tras unos 15 minutos sin uso y la primera visita tarda cerca de un minuto en despertarlo; la base de datos gratuita de Render caduca a los 30 días (se puede crear otra desde el mismo Blueprint).

> Ollama no funciona en hostings gratuitos (necesita una máquina con GPU/RAM). Para un despliegue en la nube usa `groq` o `gemini`, o apunta `AI_BASE_URL` a un servidor propio con Ollama.

Railway, Fly.io o un VPS funcionan igual: comando de build `npm run build`, comando de inicio `npm start` y las variables `DATABASE_URL`, `AI_PROVIDER_TERRA`, `AI_PROVIDER_LUNA`, `GEMINI_API_KEY` y `GROQ_API_KEY`.

## Arquitectura

```
Frontend (React)  ──/api──►  Express  ──►  Router de consultas ──► Handoff a humano
                                 │                     └──────────► IA (Terra / Luna)
                                 ├──► Consumo (tokens → USD) ──► Saldo diario C(t) ──► Alertas
                                 └──► Prisma ──► PostgreSQL
```

### Modelo Stock & Flow

```
C(t+1) = max(C(t) + R - U(t), 0)      R = presupuesto mensual / 30
```

- `C(t)`: saldo de créditos (USD) · `R`: recarga diaria · `U(t)`: consumo del día.
- Los días sin actividad se completan automáticamente aplicando solo la recarga.
- Alertas: **BAJO** (saldo < umbral), **CRÍTICO** (< 25 % del umbral), **AGOTADO** (saldo = 0).

### Simulador de escenarios

En el panel, pestaña **Simulación** (enlace directo: `/admin#simulacion`). Proyecta el saldo día a día con:

```
D(t) = V0 · (1 + g)^((t-1)/30) · (1 + ε)      ε ~ U(-v, v)
U(t) = D(t) · (1 - h) · [p · cTerra + (1 - p) · cLuna] · f
C(t) = max(C(t-1) + R - U(t), 0)
```

- Parámetros editables: demanda (V0, crecimiento g, variabilidad v), enrutamiento (% handoff h, % Terra p), tokens, factor de precios f, presupuesto, saldo inicial, umbral, horizonte y número de corridas.
- Siete escenarios predefinidos (E0 a E6); cada uno cambia **un solo parámetro** respecto del base para comparar con sentido.
- Indicadores: saldo final, día de alerta y de agotamiento, conversaciones no atendidas, gasto, presupuesto mínimo sostenible y, con variabilidad, probabilidad de agotamiento (percentiles 5–95 % de las corridas).
- Supuesto base: 2,3 millones de conversaciones/mes (Klarna, 2024), 30 % a Terra, 10 % de handoff y un presupuesto propuesto de USD 6.000/mes. Resultado: sostenible con enrutador; sin él el saldo se agota el día 42.

### Router de decisión en cascada

1. **¿Handoff?** Petición explícita de un humano, disputas, cargos no reconocidos, fraude, cuenta bloqueada o temas legales → se escala a un agente y la IA deja de responder en esa conversación.
2. **¿Terra o Luna?** Reembolsos, devoluciones, cambios de plan, denegaciones, mensajes largos o con varias preguntas → Terra. El resto → Luna.

El texto se normaliza (minúsculas, sin tildes) antes de evaluar los patrones. El usuario nunca ve qué modelo respondió.

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/mensajes` | Chat con router, IA, consumo, saldo y alertas |
| GET | `/api/saldo` | Saldo actual, recarga, consumo y días hasta agotamiento |
| GET | `/api/saldo/historial?dias=30` | Serie temporal del saldo |
| GET | `/api/alertas` | Últimas 50 alertas |
| PATCH | `/api/alertas/:id/resolver` | Marca una alerta como resuelta |
| GET | `/api/handoffs` | Escalamientos con agente asignado |
| GET | `/api/modelos/distribucion` | Consultas y costo por modelo (Terra vs Luna) |
| GET/PUT | `/api/configuracion` | Presupuesto mensual y umbral de alerta |
| GET | `/api/simulacion/escenarios` | Parámetros base y escenarios predefinidos |
| GET | `/api/simulacion/comparacion` | Indicadores de todos los escenarios |
| POST | `/api/simulacion` | Simula con parámetros personalizados |
| GET | `/api/health` | Estado de la base de datos y del proveedor de IA |

## Limitaciones conocidas (primera versión)

- No hay autenticación: el chat usa un usuario demo y el dashboard es público. No usar con datos reales.
- El router es por reglas (palabras clave); el punto de extensión para un clasificador ML está en `backend/src/services/router.ts`.
- Los agentes humanos se simulan: el handoff asigna al primer agente disponible, pero no existe una bandeja para que el agente responda.
- El dashboard está pensado para escritorio; en móviles se ve comprimido.

## Metodología

Desarrollado por un solo desarrollador con **Programación Extrema (XP)** adaptada: iteraciones cortas, historias de usuario, diseño simple, pruebas unitarias, refactorización continua e integración frecuente con Git.
