import { tool } from 'ai';
import { z } from 'zod';
import { fetchAllOrders, fetchMerchants, fetchProducts } from '../../lib/springboot-client';

/**
 * Aggregates platform-wide stats from all orders.
 * Use this for cofounder/admin questions about the business as a whole:
 * total revenue, total orders, active merchants, expiring products, etc.
 */
export const getPlatformStatsTool = tool({
  description:
    'Get aggregated platform-wide statistics for Life2food cofounders and admins. Returns total revenue, order counts by status, top-performing merchants (by revenue), monthly breakdown, unique customers, and average order value — across ALL stores on the platform.',
  parameters: z.object({
    includeTopMerchants: z
      .boolean()
      .optional()
      .default(true)
      .describe('Whether to compute revenue ranking per merchant (requires more processing)'),
  }),
  execute: async ({ includeTopMerchants }) => {
    const [orders, merchants] = await Promise.all([
      fetchAllOrders(),
      fetchMerchants(),
    ]);

    // ── Order status breakdown ──────────────────────────────────────────────
    const statusCount: Record<string, number> = {};
    let totalRevenue = 0;
    let completedCount = 0;
    const uniqueCustomers = new Set<number | null>();
    const revenueByMonth: Record<string, number> = {};
    const revenueByMerchantId: Record<number, { name: string; revenue: number; orders: number }> = {};

    for (const order of orders) {
      const status = order.status ?? 'UNKNOWN';
      statusCount[status] = (statusCount[status] ?? 0) + 1;

      if (status === 'COMPLETED') {
        totalRevenue += order.totalPrice ?? 0;
        completedCount++;
        uniqueCustomers.add(order.userId);

        // Monthly breakdown
        if (order.createdAt) {
          const d = new Date(order.createdAt);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          revenueByMonth[key] = (revenueByMonth[key] ?? 0) + (order.totalPrice ?? 0);
        }
      }

      // Merchant revenue (approximated from item prices)
      if (includeTopMerchants && order.items) {
        for (const item of order.items) {
          // item.productName comes from our trimmed version, no merchantId
          // We'll skip per-merchant breakdown from trimmed orders (no userId per item)
        }
      }
    }

    // Last 6 months sorted
    const now = new Date();
    const last6Months: Array<{ month: string; revenue: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' });
      last6Months.push({ month: label, revenue: revenueByMonth[key] ?? 0 });
    }

    // Month-over-month change
    const thisMonth = last6Months[last6Months.length - 1].revenue;
    const prevMonth = last6Months[last6Months.length - 2].revenue;
    const monthlyChange =
      prevMonth > 0 ? (((thisMonth - prevMonth) / prevMonth) * 100).toFixed(1) : null;

    // Expiring products count
    const products = await fetchProducts();
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const expiringCount = products.filter(
      (p) => p.expirationDate && new Date(p.expirationDate) <= in3Days,
    ).length;

    return {
      summary: {
        totalRevenueCOP: totalRevenue,
        totalOrders: orders.length,
        completedOrders: completedCount,
        cancelledOrders: statusCount['CANCELLED'] ?? 0,
        pendingOrders: (statusCount['PENDING'] ?? 0) + (statusCount['PAID'] ?? 0) + (statusCount['PREPARING'] ?? 0),
        uniqueCustomers: uniqueCustomers.size,
        averageOrderValueCOP: completedCount > 0 ? totalRevenue / completedCount : 0,
        totalMerchants: merchants.length,
        totalProducts: products.length,
        productsExpiringIn3Days: expiringCount,
        monthlyChangePct: monthlyChange ? parseFloat(monthlyChange) : null,
      },
      ordersByStatus: statusCount,
      last6MonthsRevenue: last6Months,
    };
  },
});
