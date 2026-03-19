import './config/env'; // validate env vars before anything else
import { initializeApp, cert } from 'firebase-admin/app';
import { env } from './config/env';
import { createApp } from './server';

// ─── Firebase Admin init ─────────────────────────────────────────────────────
const isValidFirebaseConfig =
  env.FIREBASE_PROJECT_ID &&
  env.FIREBASE_SERVICE_ACCOUNT_JSON &&
  env.FIREBASE_SERVICE_ACCOUNT_JSON !== '{"type":"service_account","project_id":"..."}';

if (isValidFirebaseConfig) {
  try {
    const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
    initializeApp({
      credential: cert(serviceAccount as Parameters<typeof cert>[0]),
      projectId: env.FIREBASE_PROJECT_ID,
    });
    console.log('[life2food-agent] Firebase Auth: enabled');
  } catch {
    console.error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON — Firebase Auth disabled');
  }
} else {
  if (env.NODE_ENV === 'production') {
    console.error('Firebase credentials required in production. Set FIREBASE_PROJECT_ID and FIREBASE_SERVICE_ACCOUNT_JSON.');
    process.exit(1);
  }
  console.warn('[life2food-agent] Firebase Auth: DISABLED (dev mode — all requests accepted without token)');
}

// ─── Start server ─────────────────────────────────────────────────────────────
const app = createApp();

app.listen(env.PORT, () => {
  console.log(`[life2food-agent] Running on http://localhost:${env.PORT}`);
  console.log(`[life2food-agent] Chat model: ${env.CHAT_MODEL}`);
  console.log(`[life2food-agent] Insight model: ${env.INSIGHT_MODEL}`);
  console.log(`[life2food-agent] Backend: ${env.LIFE2FOOD_API_URL}`);
});
