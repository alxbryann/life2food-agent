import { Router, type Request, type Response } from 'express';
import { env } from '../config/env';
import { verifyFirebaseToken, type AuthRequest } from '../lib/auth.middleware';

const router = Router();

// ElevenLabs voice ID — "Adam" (masculine, multilingual)
const VOICE_ID = 'pNInz6obpgDQGcFmaJgB';
const ELEVENLABS_URL = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;

/**
 * POST /api/agent/tts
 *
 * Body: { text: string }
 * Response: audio/mpeg stream
 */
router.post('/', verifyFirebaseToken, async (req: AuthRequest, res: Response) => {
  if (!env.ELEVENLABS_API_KEY) {
    res.status(503).json({ error: 'TTS not configured' });
    return;
  }

  const { text } = req.body as { text?: string };

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    res.status(400).json({ error: 'text is required' });
    return;
  }

  // Strip markdown before sending to TTS
  const plainText = text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .trim();

  try {
    const response = await fetch(ELEVENLABS_URL, {
      method: 'POST',
      headers: {
        'xi-api-key': env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: plainText,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[tts] ElevenLabs error:', error);
      res.status(response.status).json({ error: 'TTS provider error' });
      return;
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');

    const reader = response.body!.getReader();
    const pump = async () => {
      const { done, value } = await reader.read();
      if (done) { res.end(); return; }
      res.write(value);
      await pump();
    };
    await pump();
  } catch (err) {
    console.error('[tts] error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;
