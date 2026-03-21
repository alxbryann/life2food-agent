import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import chatRoute from './routes/chat.route';
import insightsRoute from './routes/insights.route';
import ttsRoute from './routes/tts.route';
import merchantChatRoute from './routes/merchant-chat.route';

export function createApp() {
  const app = express();

  // ─── CORS ────────────────────────────────────────────────────────────────────
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      methods: ['GET', 'POST'],
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

  return app;
}
