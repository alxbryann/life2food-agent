import { Router, type Response } from 'express';
import { chatStream } from '../agent/agent';
import { verifyFirebaseToken, type AuthRequest } from '../lib/auth.middleware';
import type { ChatRequest } from '../types/agent.types';

const router = Router();

/**
 * POST /api/agent/chat
 *
 * Body: { message: string, history?: ChatMessage[], storeOwnerId?: number }
 * Response: SSE stream (text/event-stream)
 *
 * The Angular dashboard reads the stream incrementally and renders each chunk.
 */
router.post('/', verifyFirebaseToken, async (req: AuthRequest, res: Response) => {
  const { message, history = [] } = req.body as ChatRequest;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable Nginx buffering

  try {
    const stream = chatStream(message.trim(), history);

    for await (const part of stream.fullStream) {
      if (part.type === 'reasoning') {
        res.write(`data: ${JSON.stringify({ reasoning: part.textDelta })}\n\n`);
      } else if (part.type === 'text-delta') {
        res.write(`data: ${JSON.stringify({ text: part.textDelta })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('[chat] error:', err);
    const message = err instanceof Error ? err.message : 'Internal error';
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.end();
  }
});

export default router;
