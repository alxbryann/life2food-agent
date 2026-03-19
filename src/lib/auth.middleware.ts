import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

export interface AuthRequest extends Request {
  uid?: string;
}

const firebaseEnabled =
  env.FIREBASE_PROJECT_ID &&
  env.FIREBASE_SERVICE_ACCOUNT_JSON &&
  env.FIREBASE_SERVICE_ACCOUNT_JSON !== '{"type":"service_account","project_id":"..."}';

export async function verifyFirebaseToken(
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  // In development without Firebase configured, bypass auth
  if (!firebaseEnabled) {
    req.uid = 'dev-user';
    next();
    return;
  }

  const { getAuth } = await import('firebase-admin/auth');
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    _res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const decoded = await getAuth().verifyIdToken(token);
    req.uid = decoded.uid;
    next();
  } catch {
    _res.status(401).json({ error: 'Invalid or expired Firebase token' });
  }
}
