import { tool } from 'ai';
import { z } from 'zod';
import { fetchStoreOrders, fetchAllOrders } from '../../lib/springboot-client';

export const getStoreOrdersTool = tool({
  description:
    "Get orders for a specific store owner. Returns trimmed order data with customer name, total price, store-specific status (PAID, PREPARING, READY, COMPLETED), creation date, and items. Use this when the user asks about a particular store's orders.",
  parameters: z.object({
    storeOwnerId: z.number().describe('The numeric ID of the store owner'),
  }),
  execute: async ({ storeOwnerId }) => {
    const orders = await fetchStoreOrders(storeOwnerId);
    return { total: orders.length, orders };
  },
});

export const getAllOrdersTool = tool({
  description:
    'Get all orders across the platform (admin-level view). Returns trimmed order data. Use an optional limit to avoid large responses.',
  parameters: z.object({
    limit: z.number().optional().describe('Maximum number of orders to return (default: all)'),
  }),
  execute: async ({ limit }) => {
    const orders = await fetchAllOrders(limit);
    return { total: orders.length, orders };
  },
});
