import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import chatRoute from './routes/chat.route';
import insightsRoute from './routes/insights.route';
import ttsRoute from './routes/tts.route';
import merchantChatRoute from './routes/merchant-chat.route';
import supportChatRoute from './routes/support-chat.route';

/**
 * Siempre permitidos además de CORS_ORIGIN.
 * - Web: Angular en :4200/:4300 y dashboards en producción.
 * - App nativa: React Native/Expo suele no enviar Origin → el callback recibe undefined y se acepta (no aplica CORS de navegador).
 * - Si Metro/Expo sí envía Origin (algunos entornos), :8081 evita bloqueos en desarrollo.
 */
const LIFE2FOOD_DASHBOARD_ORIGINS = [
  'http://localhost:4200',
  'http://localhost:4300',
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  'https://business.life2food.com',
  'https://owners.life2food.com',
];

export function createApp() {
  const app = express();

  // ─── CORS ────────────────────────────────────────────────────────────────────
  const fromEnv = env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);
  const allowedOrigins = [...new Set([...LIFE2FOOD_DASHBOARD_ORIGINS, ...fromEnv])];
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          console.warn(
            `[cors] blocked origin: ${origin}. Add it to CORS_ORIGIN on the server (currently allow: ${allowedOrigins.join(', ')})`,
          );
          callback(new Error(`CORS blocked: ${origin}`));
        }
      },
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );

  // ─── Body parsing ─────────────────────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));

  // ─── Rate limiting ────────────────────────────────────────────────────────────
  // 20 requests per minute per IP — protects against AI cost abuse
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please slow down.' },
  });
  app.use('/api/agent', limiter);

  // ─── Health check ─────────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', env: env.NODE_ENV });
  });

  // ─── Routes ───────────────────────────────────────────────────────────────────
  app.use('/api/agent/chat', chatRoute);
  app.use('/api/agent/merchant-chat', merchantChatRoute);
  app.use('/api/agent/insights', insightsRoute);
  app.use('/api/agent/tts', ttsRoute);
  app.use('/api/agent/support-chat', supportChatRoute);

  return app;
}
