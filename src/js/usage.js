/** How often products are used in days: for "Frequent" and for ranking search results */
import { db } from './db.js';

/** Map productId → { count, lastUsed } over all days */
export async function usageStats() {
  const days = await db.all('days');
  const stats = new Map();
  for (const day of days) {
    for (const item of day.meals.flatMap((m) => m.items)) {
      const s = stats.get(item.productId) ?? { count: 0, lastUsed: 0 };
      s.count += 1;
      s.lastUsed = Math.max(s.lastUsed, day.updatedAt ?? 0);
      stats.set(item.productId, s);
    }
  }
  return stats;
}
