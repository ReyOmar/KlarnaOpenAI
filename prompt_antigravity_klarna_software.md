# Prompt Maestro — Chat con Enrutamiento de IA + Sistema de Alertas (Klarna × OpenAI)

> Este documento es el contexto completo para iniciar el desarrollo del software en Antigravity. Contiene el modelo matemático, la arquitectura, las reglas de negocio, el modelo de datos y la especificación de pantallas. Pégalo como contexto inicial del proyecto.

---

## 1. Contexto del proyecto

Construye un prototipo funcional de software que implementa, de forma operativa, un modelo de Stock & Flow para controlar el consumo de créditos de una API de IA en un escenario de atención al cliente tipo fintech.

El software tiene **tres componentes que trabajan de forma integrada**:

1. **Chat de usuario** con enrutamiento inteligente entre dos modelos de IA (uno económico, uno más capaz).
2. **Sistema de alertas** que monitorea el saldo de créditos disponible y notifica antes de un posible agotamiento.
3. **Dashboard de administración** donde el equipo interno visualiza saldo, consumo, distribución de modelos, alertas y handoffs a humanos.

El caso de referencia es real: Klarna (fintech sueca) integró en 2024 un asistente de IA sobre la API de OpenAI que gestiona 2.3 millones de conversaciones mensuales en 23 mercados. Ese caso se usa como base de datos y reglas de negocio (ver sección 2).

---

## 2. Datos reales y supuestos (importante para no inventar cifras)

**Datos reales y verificables:**
- Volumen: 2.3 millones de conversaciones/mes (Klarna, 2024).
- Pricing de referencia de la API de OpenAI (agosto 2026): GPT-5.6 Terra = $2 USD entrada / $12 USD salida por millón de tokens; GPT-5.6 Luna = $0.20 USD entrada / $1.20 USD salida por millón de tokens (BenchLM, 2026).
- Reglas reales de Klarna sobre lo que su IA puede/no puede resolver (ver sección 5).

**Supuestos explícitos del proyecto (no tratar como hechos confirmados):**
- Que Klarna usa específicamente GPT-5.6 Terra/Luna — Klarna no ha publicado qué modelo usa internamente. Es una decisión de diseño de este proyecto, no un dato oficial.
- 800 tokens de entrada + 400 tokens de salida por conversación (promedio estimado razonable).
- Presupuesto mensual contratado de 20,000 USD (parámetro configurable, no un dato público de Klarna).

Mantén esta distinción en el código (comentarios, README) y en cualquier copy de la interfaz que lo mencione.

---

## 3. Modelo matemático (Stock & Flow)

Ecuación de acumulación del saldo de créditos:

```
C(t+1) = max(C(t) + R - U(t), 0)
```

- `C(t)`: saldo de créditos disponibles en el día t (USD).
- `R`: recarga diaria = presupuesto_mensual / 30.
- `U(t)`: consumo diario = conversaciones_del_día × costo_por_conversación(modelo).
- `costo_por_conversación(modelo)` = (tokens_entrada/1,000,000 × precio_entrada) + (tokens_salida/1,000,000 × precio_salida).

Valores base de ejemplo (presupuesto 20,000 USD/mes, 2.3M conversaciones/mes, modelo Terra):
- R ≈ 667 USD/día
- U(t) ≈ 491 USD/día
- Balance neto ≈ +176 USD/día
- C(0) = 10,000 USD (saldo inicial de ejemplo)

Este cálculo debe implementarse como una función pura y testeable (ej. `calcularSaldoDiario(saldoActual, recarga, consumo)`), reutilizada tanto por el motor de simulación como por el registro real de consumo.

---

## 4. Arquitectura del software

Organiza el sistema en capas:

- **Interfaz de usuario**: chat para clientes + dashboard para administradores (dos frontends o dos vistas de una misma app, con autenticación/roles separados).
- **Enrutamiento**: clasifica cada consulta y selecciona el modelo (o el handoff a humano).
- **Monitoreo**: actualiza saldo, consumo y proyecciones cada vez que se registra una consulta.
- **Alertas**: evalúa umbrales configurables y genera notificaciones.
- **Persistencia**: base de datos para usuarios, conversaciones, mensajes, consumo, saldos, alertas, handoffs y configuración (ver modelo de datos en sección 6).

El chat y el dashboard deben leer/escribir sobre los mismos datos de consumo — no deben ser silos separados.

---

## 5. Reglas de negocio del router (dos decisiones en cascada)

**Decisión 1 — ¿Requiere handoff a un agente humano?**
Basado en las reglas reales publicadas por Klarna sobre su asistente:

- La IA solo debe responder dentro de su alcance permitido: gestión de pagos (agendar, extender, ajustar planes), seguimiento de pedidos (estado, devoluciones, reembolsos), actualizaciones básicas de cuenta, preguntas sobre políticas/términos, y explicación de denegaciones de compra.
- Debe escalar a un humano si detecta: disputa compleja, problema de acceso a la cuenta (bloqueos, verificación, fraude), caso inusual/borde, o si el usuario pide explícitamente hablar con un representante (ej. frase literal "quiero un representante").
- Si escala: registrar el `Handoff` con motivo y no llamar a ningún modelo de IA para esa consulta.

**Decisión 2 — Si no requiere handoff, ¿qué modelo usar?**
- Consulta compleja o sensible dentro del alcance de la IA → modelo de mayor capacidad (Terra).
- Consulta simple y de bajo riesgo → modelo económico (Luna).
- Esta clasificación puede implementarse inicialmente con reglas simples (palabras clave, longitud, tipo de intención) y dejar preparado el punto de extensión para un clasificador más sofisticado más adelante.

Cada consulta que sí llega a un modelo de IA debe generar un registro de `ConsumoAPI` con tokens y costo, que a su vez actualiza `SaldoDiario`.

---

## 6. Modelo de datos (entidades)

Implementa estas entidades (nombres de tabla en snake_case, adaptа al ORM que uses):

| Entidad | Atributos clave | Relación |
|---|---|---|
| `Usuario` | id, nombre, email, fecha_registro | 1—N con `Conversacion` |
| `Conversacion` | id, id_usuario (FK), fecha_inicio, estado | 1—N con `Mensaje`; 1—0..1 con `Handoff` |
| `Mensaje` | id, id_conversacion (FK), id_modelo (FK, nulo si es humano), remitente, contenido, timestamp | N—1 con `ModeloIA`; 1—0..1 con `ConsumoAPI` |
| `ModeloIA` | id, nombre (Terra/Luna), costo_entrada_musd, costo_salida_musd | 1—N con `Mensaje` y `ConsumoAPI` |
| `ConsumoAPI` | id, id_mensaje (FK), id_modelo (FK), tokens_entrada, tokens_salida, costo_usd, fecha | actualiza `SaldoDiario` |
| `SaldoDiario` | id, fecha, saldo_c_t, recarga_r, consumo_u | 1—N con `Alerta` |
| `Alerta` | id, id_saldo (FK), tipo, umbral_usd, estado, fecha | — |
| `Agente` | id, nombre, email, disponible | 1—N con `Handoff` |
| `Handoff` | id, id_conversacion (FK), id_agente (FK), motivo, estado, fecha | — |
| `Configuracion` | id, presupuesto_mensual, umbral_alerta, fecha_actualizacion | fila única de configuración global |

---

## 7. Especificación de pantallas

### 7.1 Chat (usuario final)

Estilo visual: modo oscuro, fondo casi negro (#08080b), tarjetas gris oscuro (#0c0c11) con bordes sutiles, tipografía sans-serif limpia, acentos semánticos (verde=positivo, morado=marca, naranja=alertas/costo, rojo=error/escalamiento). Sin emojis, iconografía geométrica simple.

Estructura:
- Header: nombre de marca + indicador "Asistente en línea" (punto verde).
- Área de conversación con burbujas (usuario a la derecha en morado sutil, asistente a la izquierda en gris con avatar), estado "escribiendo…" animado, y una variante de burbuja para cuando responde un agente humano (avatar de persona + etiqueta "Agente humano").
- Barra de entrada inferior con campo de texto, botón de enviar, y un link discreto "Prefiero hablar con un representante" que fuerza el handoff.
- El usuario **no debe ver** qué modelo respondió — la complejidad del router es invisible para él.

### 7.2 Dashboard (administrador)

Mismo lenguaje visual que el chat, layout con sidebar (Resumen, Alertas, Enrutamiento de modelos, Handoffs, Configuración).

- 4 tarjetas de métricas: Saldo actual C(t), Consumo diario U(t), Recarga diaria R, Días hasta agotamiento (o símbolo ∞).
- Gráfico de línea de C(t) en los últimos 30 días con línea de referencia en $0.
- Tarjeta de distribución de modelos: barra apilada Terra vs. Luna con costo acumulado de cada uno.
- Tabla de alertas recientes (fecha, tipo, umbral, estado).
- Tabla de handoffs (fecha, motivo, agente asignado, estado).
- Panel de configuración: presupuesto mensual y umbral de alerta editables.

---

## 8. Requerimientos funcionales

| Código | Requerimiento | Prioridad |
|---|---|---|
| RF-01 | Permitir al usuario enviar consultas mediante un chat | Alta |
| RF-02 | Clasificar la consulta según las reglas del router (whitelisting + complejidad) | Alta |
| RF-03 | Enrutar la consulta a Terra, Luna, o a handoff humano | Alta |
| RF-04 | Registrar el modelo utilizado y el consumo generado (tokens y costo) | Alta |
| RF-05 | Actualizar el saldo C(t) y los indicadores del modelo tras cada consulta | Alta |
| RF-06 | Generar alertas cuando C(t) cae bajo el umbral configurado | Alta |
| RF-07 | Mostrar saldo, tendencia y días estimados hasta agotamiento en el dashboard | Alta |
| RF-08 | Mostrar distribución de consultas y costo acumulado por modelo | Media |
| RF-09 | Permitir configurar reglas del router, presupuesto y umbral de alerta | Media |
| RF-10 | Consultar historial de alertas y de handoffs | Media |

## 9. Requerimientos no funcionales

- Interfaz de usuario final simple y sin jerga técnica.
- Dashboard con datos que se puedan refrescar (polling o websockets, a elección).
- Trazabilidad completa: toda consulta que consume créditos debe quedar registrada.
- Separación clara de roles: usuario final nunca accede a vistas de administrador.
- Las reglas de enrutamiento y los umbrales deben poder modificarse sin tocar el motor matemático del modelo (parámetros, no valores hardcodeados).

---

## 10. Stack tecnológico sugerido

Sugerencia de punto de partida (ajustable según lo que Antigravity recomiende o lo que prefieras):

- **Frontend**: React + Tailwind (chat y dashboard como dos rutas de la misma app, o dos apps si prefieres separarlas).
- **Backend**: Node.js (Express o Fastify) o Python (FastAPI) — expone endpoints REST para mensajes, consumo, saldo, alertas y configuración.
- **Base de datos**: PostgreSQL o SQLite para el prototipo, siguiendo el modelo de la sección 6.
- **IA**: llamadas a la API de OpenAI (o un mock/simulador configurable para desarrollo sin gastar créditos reales), seleccionando el modelo según la salida del router.
- **Gráficos**: Chart.js o Recharts para el dashboard.

## 11. Estructura de carpetas sugerida

```
/backend
  /src
    /models        (entidades de la sección 6)
    /routes         (endpoints REST)
    /services
      router.ts         (decisión handoff + Terra/Luna)
      consumo.ts         (cálculo de costo por conversación)
      saldo.ts           (ecuación C(t+1) = max(C(t)+R-U(t), 0))
      alertas.ts         (evaluación de umbrales)
    /db
/frontend
  /chat            (pantalla de usuario final)
  /admin           (dashboard de administrador)
  /components
  /styles
README.md
```

## 12. Endpoints sugeridos (API)

- `POST /api/mensajes` — recibe un mensaje del usuario, ejecuta el router, devuelve la respuesta.
- `GET /api/saldo` — saldo actual C(t), recarga R, consumo U(t) y proyección de días hasta agotamiento.
- `GET /api/saldo/historial?dias=30` — serie de C(t) para el gráfico.
- `GET /api/alertas` — alertas activas e históricas.
- `GET /api/handoffs` — historial de handoffs con motivo y agente.
- `GET /api/modelos/distribucion` — % de consultas por modelo y costo acumulado.
- `PUT /api/configuracion` — actualizar presupuesto mensual y umbral de alerta.

---

## 13. Checklist para el primer MVP

- [ ] Motor matemático del modelo (ecuación + cálculo de costo por conversación) como funciones puras con pruebas unitarias.
- [ ] Router con las dos decisiones en cascada (handoff / Terra-Luna).
- [ ] Persistencia mínima de las 10 entidades.
- [ ] Chat funcional conectado al router (puede usar un mock de la API de IA al inicio).
- [ ] Registro automático de consumo tras cada respuesta de IA.
- [ ] Endpoint y vista de saldo con gráfico de 30 días.
- [ ] Sistema de alertas disparando cuando C(t) cruza el umbral.
- [ ] Dashboard mínimo mostrando saldo, alertas y distribución de modelos.
- [ ] Nota visible en el README sobre los supuestos (sección 2) para no presentar a Terra/Luna como confirmado por Klarna.
