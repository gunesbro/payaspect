import type { Budget } from "./types.ts";
import type { SpendingSummary } from "../db/repositories/insights.ts";

/** Current-month usage of one budget, derived from an existing spending summary. */
export interface BudgetProgress {
  budget: Budget;
  /** Expenses booked to this category in this currency this month. */
  spent: number;
  /** spent / amount, not clamped (may exceed 1). */
  ratio: number;
  /** amount - spent, floored at zero. */
  remaining: number;
  /** True when spending has reached or passed the limit. */
  over: boolean;
}

/**
 * Pair each budget with its category spending for the current month.
 * Currencies are matched exactly and never mixed. `null` category ids in the
 * summary are ignored because budgets always target a concrete category.
 */
export function computeBudgetProgress(
  budgets: Budget[],
  summary: SpendingSummary | null,
): BudgetProgress[] {
  const spentByKey = new Map<string, number>();
  for (const currency of summary?.byCurrency ?? []) {
    for (const row of currency.byCategory) {
      if (!row.categoryId) continue;
      spentByKey.set(`${currency.currency}\u0000${row.categoryId}`, row.total);
    }
  }

  return budgets
    .map((budget) => {
      const spent = spentByKey.get(`${budget.currency}\u0000${budget.categoryId}`) ?? 0;
      const ratio = budget.amount > 0 ? spent / budget.amount : 0;
      return {
        budget,
        spent,
        ratio,
        remaining: Math.max(0, Math.round((budget.amount - spent) * 100) / 100),
        over: spent >= budget.amount,
      };
    })
    .sort((a, b) => b.ratio - a.ratio || a.budget.categoryId.localeCompare(b.budget.categoryId));
}
