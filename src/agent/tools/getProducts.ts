import { tool } from 'ai';
import { z } from 'zod';
import { fetchProducts } from '../../lib/springboot-client';

export const getProductsTool = tool({
  description:
    'Get products from the platform. Can filter by store owner ID and/or only return products expiring within N days. Returns product name, price, expiration date, stock amount, store name, and category.',
  parameters: z.object({
    userId: z
      .number()
      .optional()
      .describe('Store owner user ID. If omitted, returns products from all stores.'),
    expiringWithinDays: z
      .number()
      .optional()
      .describe(
        'If provided, only return products that expire within this many days from today. E.g. 3 = expiring in the next 3 days.',
      ),
  }),
  execute: async ({ userId, expiringWithinDays }) => {
    const products = await fetchProducts(userId);

    if (expiringWithinDays !== undefined) {
      const now = new Date();
      const cutoff = new Date(now.getTime() + expiringWithinDays * 24 * 60 * 60 * 1000);
      const expiring = products.filter((p) => {
        if (!p.expirationDate) return false;
        const exp = new Date(p.expirationDate);
        return exp <= cutoff;
      });
      return { total: expiring.length, products: expiring };
    }

    return { total: products.length, products };
  },
});
