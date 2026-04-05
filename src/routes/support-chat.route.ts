import { Router, type Response } from 'express';
import { supportChat } from '../agent/agent';
import { verifyFirebaseToken, type AuthRequest } from '../lib/auth.middleware';
import { firebaseIdTokenFromRequest, runWithSpringBootAuth } from '../lib/backend-auth-context';

const router = Router();

/**
 * POST /api/agent/support-chat
 *
 * Body: { message: string, user_id: number, role?: string }
 * Auth: Bearer <Firebase ID token> (Authorization header)
 * Response: { reply: string }
 *
 * Called directly from the mobile app (bypasses Spring Boot),
 * same pattern as /api/agent/chat and /api/agent/merchant-chat.
 */
router.post('/', verifyFirebaseToken, async (req: AuthRequest, res: Response) => {
  const { message, user_id, role = 'usuario' } = req.body as {
    message?: string;
    user_id?: number;
    role?: string;
  };

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ error: 'El mensaje no puede estar vacío.' });
    return;
  }

  if (user_id === undefined || user_id === null) {
    res.status(400).json({ error: 'user_id requerido.' });
    return;
  }

  const idToken = firebaseIdTokenFromRequest(req);

  try {
    const result = await runWithSpringBootAuth(idToken, () =>
      supportChat(message.trim(), Number(user_id), role),
    );
    res.json({
      reply: result.text,
      products: result.products,
      stores: result.stores,
    });
  } catch (err) {
    console.error('[support-chat] error:', err);
    res.status(500).json({ reply: 'Lo siento, tuve un problema al procesar tu solicitud. Intenta de nuevo.', products: [], stores: [] });
  }
});

export default router;
