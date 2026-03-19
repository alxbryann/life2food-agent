import { tool } from 'ai';
import { z } from 'zod';
import { fetchEarnings } from '../../lib/springboot-client';

export const getEarningsTool = tool({
  description:
    'Get the earnings summary for a store owner: balance available, in-process amount, total earned, completed orders count, unique clients, average order value, monthly % change, and the last 6 months of earnings data.',
  parameters: z.object({
    storeOwnerId: z.number().describe('The numeric ID of the store owner'),
  }),
  execute: async ({ storeOwnerId }) => {
    const data = await fetchEarnings(storeOwnerId);
    return data;
  },
});
