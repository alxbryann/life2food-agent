# Life2Food Agent

Microservicio de IA para el dashboard de negocios de Life2Food. Proporciona análisis, insights y recomendaciones a los dueños de restaurantes.

## Stack
- Node.js + TypeScript + Express
- Vercel AI SDK (`ai`, `@ai-sdk/*`)
- Modelos: Anthropic Claude, OpenAI, Google, DeepSeek
- Firebase Admin (auth/Firestore)
- Docker

## Comandos
```bash
npm run dev        # dev con watch
npm run build      # compilar TypeScript
npm start          # producción
```

## Estructura
```
src/
  agent/      # lógica del agente IA
  config/     # configuración (modelos, Firebase)
  lib/        # utilidades compartidas
  routes/     # endpoints Express
  types/      # tipos TypeScript
  server.ts   # entry point
  index.ts
```

## Convenciones
- Usar Vercel AI SDK para todas las llamadas a modelos — no usar SDKs de proveedor directamente
- Rate limiting activo (`express-rate-limit`) — respetar en tests
- Caché con `node-cache` — considerar TTL al agregar nuevas queries
- Validar schemas con `zod`
- No logguear prompts completos ni respuestas de usuarios en producción

## Contexto de negocio
- El agente asiste a **dueños de negocios** (restaurantes, cafeterías, etc.)
- Insights sobre ventas, stock, tendencias de clientes
- Tono: directo, útil, orientado a acción
- Primero el beneficio concreto para el negocio, luego métricas de impacto

## Seguridad
- Autenticación vía Firebase Admin antes de cualquier respuesta del agente
- API keys en variables de entorno — nunca en código
- Sanitizar inputs antes de incluir en prompts
