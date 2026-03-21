import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  // AI provider keys — at least one must be set (validated at runtime in agent.ts)
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  ELEVENLABS_API_KEY: z.string().optional(),

  // Model selection
  CHAT_MODEL: z.string().default('deepseek-chat'),
  INSIGHT_MODEL: z.string().default('deepseek-chat'),

  // Life2food backend
  LIFE2FOOD_API_URL: z.string().url().default('https://api.life2food.com'),
  INTERNAL_API_KEY: z.string().default(''),

  // Firebase — optional in development
  FIREBASE_PROJECT_ID: z.string().default(''),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().default(''),

  // Server
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:4200'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

// Validate that at least one AI key is present
const hasAnyKey =
  env.ANTHROPIC_API_KEY ||
  env.OPENAI_API_KEY ||
  env.GOOGLE_GENERATIVE_AI_API_KEY ||
  env.GROQ_API_KEY ||
  env.DEEPSEEK_API_KEY;

if (!hasAnyKey) {
  console.error(
    'No AI provider key found. Set one of: ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, GROQ_API_KEY, DEEPSEEK_API_KEY',
  );
  process.exit(1);
}
