import { Router, type Response } from 'express';
import { merchantChatStream } from '../agent/agent';
import { verifyFirebaseToken, type AuthRequest } from '../lib/auth.middleware';

const router = Router();

/**
 * POST /api/agent/merchant-chat
 *
 * Body: { message: string, storeOwnerId: number, storeName: string, history?: ChatMessage[] }
 * Response: SSE stream (text/event-stream)
 *
 * Used by Business Dashboard. The agent is locked to the given storeOwnerId —
 * it can only see and discuss data for that specific store.
 */
router.post('/', verifyFirebaseToken, async (req: AuthRequest, res: Response) => {
  const { message, storeOwnerId, storeName, history = [] } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  if (!storeOwnerId || typeof storeOwnerId !== 'number') {
    res.status(400).json({ error: 'storeOwnerId is required and must be a number' });
    return;
  }

  const name = typeof storeName === 'string' && storeName.trim() ? storeName.trim() : 'tu tienda';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const stream = merchantChatStream(message.trim(), storeOwnerId, name, history);

    for await (const part of stream.fullStream) {
      if (part.type === 'text-delta') {
        res.write(`data: ${JSON.stringify({ text: part.textDelta })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('[merchant-chat] error:', err);
    const msg = err instanceof Error ? err.message : 'Internal error';
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    res.end();
  }
});

export default router;
