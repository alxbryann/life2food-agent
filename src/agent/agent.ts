import { streamText, generateText, tool } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { z } from 'zod';
import { env } from '../config/env';
import { buildSystemPrompt, buildMerchantSystemPrompt } from './system-prompt';
import {
  getPlatformStatsTool,
  getEarningsTool,
  getStoreOrdersTool,
  getAllOrdersTool,
  getProductsTool,
  getMerchantsTool,
  getWithdrawalsTool,
} from './tools';
import {
  fetchStoreOrders,
  fetchEarnings,
  fetchProducts,
  fetchWithdrawals,
} from '../lib/springboot-client';
import type { ChatMessage, Insight } from '../types/agent.types';

// ─── Model provider factory ───────────────────────────────────────────────────

function resolveModelForId(modelId: string) {
  // DeepSeek
  if (env.DEEPSEEK_API_KEY && (modelId.startsWith('deepseek') || (!hasNonDeepSeekKey() && env.DEEPSEEK_API_KEY))) {
    return createDeepSeek({ apiKey: env.DEEPSEEK_API_KEY })(modelId);
  }
  // Anthropic
  if (env.ANTHROPIC_API_KEY && modelId.startsWith('claude')) {
    return createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })(modelId);
  }
  // OpenAI
  if (env.OPENAI_API_KEY && (modelId.startsWith('gpt') || modelId.startsWith('o1') || modelId.startsWith('o3'))) {
    return createOpenAI({ apiKey: env.OPENAI_API_KEY })(modelId);
  }
  // Google
  if (env.GOOGLE_GENERATIVE_AI_API_KEY && modelId.startsWith('gemini')) {
    return createGoogleGenerativeAI({ apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY })(modelId);
  }

  // Fallback: use whichever key is available
  if (env.DEEPSEEK_API_KEY) return createDeepSeek({ apiKey: env.DEEPSEEK_API_KEY })(modelId);
  if (env.ANTHROPIC_API_KEY) return createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })(modelId);
  if (env.OPENAI_API_KEY) return createOpenAI({ apiKey: env.OPENAI_API_KEY })(modelId);
  if (env.GOOGLE_GENERATIVE_AI_API_KEY) return createGoogleGenerativeAI({ apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY })(modelId);

  throw new Error('No AI provider key configured. Check your .env file.');
}

function resolveModel() {
  return resolveModelForId(env.CHAT_MODEL);
}

function resolveInsightModel() {
  return resolveModelForId(env.INSIGHT_MODEL);
}

function hasNonDeepSeekKey(): boolean {
  return !!(env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY || env.GROQ_API_KEY);
}

// ─── Shared tools registry ───────────────────────────────────────────────────

const tools = {
  getPlatformStats: getPlatformStatsTool,   // platform-wide — default for cofounder questions
  getMerchants: getMerchantsTool,           // list/analyze all business partners
  getAllOrders: getAllOrdersTool,            // all orders across the platform
  getProducts: getProductsTool,             // all products / expiration analysis
  getStoreOrders: getStoreOrdersTool,       // drill-down: orders of a specific store
  getEarnings: getEarningsTool,             // drill-down: earnings of a specific store
  getWithdrawals: getWithdrawalsTool,       // drill-down: withdrawals of a specific store
};

// ─── Chat (streaming) ─────────────────────────────────────────────────────────

export function chatStream(message: string, history: ChatMessage[] = []) {
  const model = resolveModel();

  return streamText({
    model,
    system: buildSystemPrompt(),
    messages: [
      ...history.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ],
    tools,
    maxSteps: 10, // allow multiple sequential tool calls per response
  });
}

// ─── Merchant chat (streaming) — locked to a single store ────────────────────

function createMerchantTools(storeOwnerId: number) {
  return {
    getMyOrders: tool({
      description:
        'Get all orders for my store. Returns order list with customer name, items, prices, store status, and creation date. Use this to answer questions about how much was sold today, pending orders, etc.',
      parameters: z.object({}),
      execute: async () => {
        const orders = await fetchStoreOrders(storeOwnerId);
        return { total: orders.length, orders };
      },
    }),
    getMyEarnings: tool({
      description:
        'Get earnings summary for my store: total earned, balance available, in-process amount, completed orders count, unique clients, average order value, monthly breakdown and percent change vs previous month.',
      parameters: z.object({}),
      execute: async () => {
        return await fetchEarnings(storeOwnerId);
      },
    }),
    getMyProducts: tool({
      description:
        'Get products from my store. Optionally filter to only show products expiring within N days. Returns product name, price, stock, expiration date, and category.',
      parameters: z.object({
        expiringWithinDays: z
          .number()
          .optional()
          .describe('Only return products expiring within this many days from today.'),
      }),
      execute: async ({ expiringWithinDays }) => {
        const products = await fetchProducts(storeOwnerId);
        if (expiringWithinDays !== undefined) {
          const now = new Date();
          const cutoff = new Date(now.getTime() + expiringWithinDays * 24 * 60 * 60 * 1000);
          const expiring = products.filter((p) => {
            if (!p.expirationDate) return false;
            return new Date(p.expirationDate) <= cutoff;
          });
          return { total: expiring.length, products: expiring };
        }
        return { total: products.length, products };
      },
    }),
    getMyWithdrawals: tool({
      description: 'Get withdrawal history for my store.',
      parameters: z.object({}),
      execute: async () => {
        const withdrawals = await fetchWithdrawals(storeOwnerId);
        return { total: withdrawals.length, withdrawals };
      },
    }),
  };
}

export function merchantChatStream(
  message: string,
  storeOwnerId: number,
  storeName: string,
  history: ChatMessage[] = [],
) {
  const model = resolveModel();
  const merchantTools = createMerchantTools(storeOwnerId);

  return streamText({
    model,
    system: buildMerchantSystemPrompt(storeOwnerId, storeName),
    messages: [
      ...history.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ],
    tools: merchantTools,
    maxSteps: 5,
  });
}

// ─── Insights (non-streaming) ─────────────────────────────────────────────────

export async function generateInsights(storeOwnerId: number): Promise<Insight[]> {
  const model = resolveInsightModel();

  const prompt = `Eres un asistente de análisis de negocio para Life2food. Analiza los datos del comerciante con ID ${storeOwnerId} usando las herramientas disponibles y genera entre 3 y 5 alertas o insights prioritarios.

Para cada insight usa este formato JSON:
{
  "type": "warning" | "info" | "success" | "error",
  "title": "Título corto (max 60 chars)",
  "description": "Descripción detallada con número o dato concreto",
  "priority": 1-5 (1 = más urgente)
}

Ejemplos de insights útiles:
- Productos próximos a vencer (warning/error)
- Cambio positivo o negativo en ganancias vs mes anterior (success/warning)
- Órdenes en estado PREPARING por mucho tiempo (warning)
- Retiros pendientes (info)
- Clientes únicos nuevos (info/success)

Devuelve SOLO un array JSON válido, sin texto adicional.`;

  const result = await generateText({
    model,
    system: buildSystemPrompt(),
    prompt,
    tools,
    maxSteps: 8,
  });

  try {
    // Extract JSON array from the response text
    const text = result.text.trim();
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    return JSON.parse(match[0]) as Insight[];
  } catch {
    console.error('Failed to parse insights JSON:', result.text);
    return [];
  }
}
