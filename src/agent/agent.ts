import { streamText, generateText, tool } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { z } from 'zod';
import { env } from '../config/env';
import { buildSystemPrompt, buildMerchantSystemPrompt } from './system-prompt';
import { buildSupportSystemPrompt } from './support-prompt';
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
  fetchMerchantsPublic,
  type PublicStore,
} from '../lib/springboot-client';
import type { TrimmedProduct } from '../types/api.types';
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

// ─── Support chat (non-streaming) — for end users via mobile app ─────────────

const supportTools = {
  searchProducts: tool({
    description:
      'Search available products on the platform by keyword (product name) and/or category. Returns matching products with name, price, store, and category. Use this when the user asks for food recommendations or wants to find a specific product.',
    parameters: z.object({
      query: z.string().optional().describe('Keyword to search in product name (e.g. "pizza", "ensalada", "pollo")'),
      category: z.string().optional().describe('Filter by category name (e.g. "Panadería", "Lácteos", "Frutas")'),
    }),
    execute: async ({ query, category }) => {
      const products = await fetchProducts();
      let results = products;
      if (query) {
        const q = query.toLowerCase();
        results = results.filter(
          (p) => p.name.toLowerCase().includes(q) || (p.category ?? '').toLowerCase().includes(q),
        );
      }
      if (category) {
        const cat = category.toLowerCase();
        results = results.filter((p) => (p.category ?? '').toLowerCase().includes(cat));
      }
      return { total: results.length, products: results.slice(0, 20) };
    },
  }),

  searchStores: tool({
    description:
      'Search stores/merchants on the platform by type of business or name. Returns store name, category, address, description, and hours. Use this when the user asks "¿qué tiendas hay?", "¿dónde compro X?", or wants to find a specific type of store.',
    parameters: z.object({
      query: z
        .string()
        .optional()
        .describe('Keyword to search in store name, category, or address (e.g. "pizza", "restaurante", "panadería")'),
    }),
    execute: async ({ query }) => {
      const stores = await fetchMerchantsPublic();
      if (!query) return { total: stores.length, stores: stores.slice(0, 20) };
      const q = query.toLowerCase();
      const results = stores.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.businessCategory ?? '').toLowerCase().includes(q) ||
          (s.address ?? '').toLowerCase().includes(q) ||
          (s.storeDescription ?? '').toLowerCase().includes(q),
      );
      return { total: results.length, stores: results.slice(0, 20) };
    },
  }),

  listCategories: tool({
    description:
      'List all product categories available on the platform. Use this when the user asks what types of food or categories are available.',
    parameters: z.object({}),
    execute: async () => {
      const products = await fetchProducts();
      const categories = [...new Set(products.map((p) => p.category).filter(Boolean))].sort();
      return { total: categories.length, categories };
    },
  }),
};

export interface SupportChatResult {
  text: string;
  products: TrimmedProduct[];
  stores: PublicStore[];
}

export async function supportChat(
  message: string,
  userId: number,
  role: string,
  history: ChatMessage[] = [],
): Promise<SupportChatResult> {
  const model = resolveModel();

  const result = await generateText({
    model,
    system: buildSupportSystemPrompt(),
    messages: [
      ...history.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ],
    tools: supportTools,
    maxSteps: 5,
  });

  const fullText = result.steps
    .map((s) => s.text)
    .filter((t) => t && t.trim().length > 0)
    .join('\n\n')
    .trim();

  // Extract structured results from tool calls across all steps
  const products: TrimmedProduct[] = [];
  const stores: PublicStore[] = [];

  for (const step of result.steps) {
    for (const tr of (step.toolResults ?? []) as Array<{ toolName: string; result: any }>) {
      if (tr.toolName === 'searchProducts') {
        products.push(...(tr.result.products ?? []));
      } else if (tr.toolName === 'searchStores') {
        stores.push(...(tr.result.stores ?? []));
      }
    }
  }

  return {
    text: fullText || 'Lo siento, no pude procesar tu solicitud. Intenta de nuevo.',
    products,
    stores,
  };
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
