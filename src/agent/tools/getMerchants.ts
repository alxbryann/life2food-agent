import { tool } from 'ai';
import { z } from 'zod';
import { fetchMerchants } from '../../lib/springboot-client';

export const getMerchantsTool = tool({
  description:
    'Get all business merchants (stores/restaurants/farms) registered on the platform. Returns their ID, name, email, business category, and address.',
  parameters: z.object({}),
  execute: async () => {
    const merchants = await fetchMerchants();
    return { total: merchants.length, merchants };
  },
});
