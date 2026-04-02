import { Router, type Response } from 'express';
import { generateInsights } from '../agent/agent';
import { firebaseIdTokenFromRequest, runWithSpringBootAuth } from '../lib/backend-auth-context';
import { verifyFirebaseToken, type AuthRequest } from '../lib/auth.middleware';
import { getCached, setCached } from '../lib/cache';
import type { InsightsResponse } from '../types/agent.types';

const router = Router();

const INSIGHTS_TTL = 5 * 60; // 5 minutes

/**
 * GET /api/agent/insights/:storeId
 *
 * Returns 3-5 AI-generated insights/alerts for the given store.
 * Response is cached for 5 minutes to reduce AI API costs.
 */
router.get('/:storeId', verifyFirebaseToken, async (req: AuthRequest, res: Response) => {
  const storeId = parseInt(req.params.storeId, 10);

  if (isNaN(storeId)) {
    res.status(400).json({ error: 'storeId must be a number' });
    return;
  }

  const cacheKey = `insights:${storeId}`;
  const cached = getCached<InsightsResponse>(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  const idToken = firebaseIdTokenFromRequest(req);

  try {
    const insights = await runWithSpringBootAuth(idToken, () => generateInsights(storeId));
    const response: InsightsResponse = {
      insights,
      generatedAt: new Date().toISOString(),
    };
    setCached(cacheKey, response, INSIGHTS_TTL);
    res.json(response);
  } catch (err) {
    console.error('[insights] error:', err);
    res.status(500).json({ error: 'Failed to generate insights' });
  }
});

export default router;
