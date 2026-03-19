import { tool } from 'ai';
import { z } from 'zod';
import { fetchWithdrawals } from '../../lib/springboot-client';

export const getWithdrawalsTool = tool({
  description:
    "Get withdrawal history for a store owner. Returns each withdrawal's amount, status (PENDING, COMPLETED, REJECTED), and date.",
  parameters: z.object({
    storeOwnerId: z.number().describe('The numeric ID of the store owner'),
  }),
  execute: async ({ storeOwnerId }) => {
    const withdrawals = await fetchWithdrawals(storeOwnerId);
    return { total: withdrawals.length, withdrawals };
  },
});
