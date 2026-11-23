/**
 * Template-based question answering (layer A).
 *
 * Answers are produced only from data already loaded on the device. No model,
 * network or new dependency is involved. Every sentence comes from an i18n
 * template, and currencies are never combined.
 */

import { formatAmount, formatPercent } from "../format.ts";
import type { Locale, Translator } from "../i18n/index.ts";
import type {
  CurrencySpendingSummary,
  SpendingSummary,
  SpendingTrend,
} from "../db/repositories/insights.ts";
import { detectSpendingAnomalies } from "./anomalies.ts";
import { computeBudgetProgress } from "./budgets.ts";
import { compareSpending } from "./spendingComparison.ts";
import type { Account, Budget, Category } from "./types.ts";

export type QuestionId =
  | "monthTotal"
  | "topCategory"
  | "monthComparison"
  | "budgetStatus"
  | "anomalies"
  | "topMerchant"
  | "topAccount";

/** Fixed question list, in display order. Labels are i18n keys. */
export const ASKABLE_QUESTIONS: ReadonlyArray<{
  id: QuestionId;
  labelKey: string;
}> = [
  { id: "monthTotal", labelKey: "qa.q.monthTotal" },
  { id: "topCategory", labelKey: "qa.q.topCategory" },
  { id: "monthComparison", labelKey: "qa.q.monthComparison" },
  { id: "budgetStatus", labelKey: "qa.q.budgetStatus" },
  { id: "anomalies", labelKey: "qa.q.anomalies" },
  { id: "topMerchant", labelKey: "qa.q.topMerchant" },
  { id: "topAccount", labelKey: "qa.q.topAccount" },
];

export interface AnswerContext {
  summary: SpendingSummary | null;
  trend: SpendingTrend | null;
  budgets: Budget[];
  accounts: Account[];
  categories: Category[];
  locale: Locale;
}

/** Resolve a stored category id using the same rules as the UI labels. */
function categoryName(
  categoryId: string | null,
  categories: Category[],
  t: Translator,
): string {
  if (!categoryId) return t("common.noData");
  const stored = categories.find((category) => category.id === categoryId);
  if (stored) {
    return stored.name.startsWith("category.") ? t(stored.name) : stored.name;
  }
  if (categoryId.startsWith("sys_")) {
    return t(`category.${categoryId.slice(4)}`);
  }
  return categoryId;
}

interface MoneyRow {
  total: number;
}

/** Largest row inside one currency, then the largest across currencies. */
function largestAcrossCurrencies<T extends MoneyRow>(
  currencies: CurrencySpendingSummary[],
  rowsOf: (currency: CurrencySpendingSummary) => T[],
): T | null {
  let best: T | null = null;
  for (const currency of currencies) {
    const row = rowsOf(currency).reduce<T | null>(
      (top, candidate) => (!top || candidate.total > top.total ? candidate : top),
      null,
    );
    if (row && (!best || row.total > best.total)) best = row;
  }
  return best;
}

/**
 * Answer one of the fixed questions with a template-based sentence.
 * Returns a "not enough data" sentence instead of guessing when the relevant
 * data is missing.
 */
export function answerQuestion(
  id: QuestionId,
  context: AnswerContext,
  t: Translator,
): string {
  const { summary, trend, budgets, accounts, categories, locale } = context;
  const currencies = summary?.byCurrency ?? [];

  if (currencies.length === 0) return t("insights.noData");

  const multiCurrency = (): string => t("qa.a.multiCurrency");

  switch (id) {
    case "monthTotal": {
      if (summary?.total == null || summary.currency == null) {
        return currencies.length > 1 ? multiCurrency() : t("insights.noData");
      }
      if (summary.total === 0) return t("qa.a.noSpending");
      return t("qa.a.monthTotal", {
        amount: formatAmount(summary.total, summary.currency, locale),
      });
    }

    case "topCategory": {
      if (currencies.length > 1) return multiCurrency();
      const top = largestAcrossCurrencies(currencies, (c) => c.byCategory);
      if (!top || !top.categoryId || top.total <= 0) return t("insights.noData");
      return t("qa.a.topCategory", {
        category: categoryName(top.categoryId, categories, t),
        amount: formatAmount(top.total, currencies[0]!.currency, locale),
      });
    }

    case "monthComparison": {
      if (summary?.total == null || summary.currency == null) {
        return currencies.length > 1 ? multiCurrency() : t("insights.noData");
      }
      const points = trend?.byCurrency.find(
        (entry) => entry.currency === summary.currency,
      )?.points;
      if (!points || points.length < 2) return t("insights.noData");

      const previous = points[points.length - 2]!.total;
      if (previous === 0) return t("insights.summaryNoPrevious");

      const change = compareSpending(summary.total, previous);
      if (!change) return t("insights.noData");
      if (change.direction === "flat") return t("insights.summaryFlat");
      return t(
        change.direction === "up" ? "insights.summaryUp" : "insights.summaryDown",
        { percent: formatPercent(Math.abs(change.percent), locale) },
      );
    }

    case "budgetStatus": {
      const progress = computeBudgetProgress(budgets, summary);
      const top = progress[0];
      if (!top) return t("qa.a.budgetNone");

      const label = categoryName(top.budget.categoryId, categories, t);
      if (top.over) {
        return t("qa.a.budgetOver", {
          category: label,
          amount: formatAmount(
            top.spent - top.budget.amount,
            top.budget.currency,
            locale,
          ),
        });
      }
      return t("qa.a.budgetRemaining", {
        category: label,
        amount: formatAmount(top.remaining, top.budget.currency, locale),
      });
    }

    case "anomalies": {
      if (!trend) return t("insights.noData");
      const anomaly = detectSpendingAnomalies(trend)[0];
      if (!anomaly) {
        const hasHistory = trend.byCategory.some(
          (entry) => entry.points.length >= 3,
        );
        return t(
          hasHistory ? "insights.anomalyNone" : "insights.anomalyNeedData",
        );
      }
      return t("qa.a.anomaly", {
        category: categoryName(anomaly.categoryId, categories, t),
        percent: formatPercent(anomaly.percent, locale),
      });
    }

    case "topMerchant": {
      if (currencies.length > 1) return multiCurrency();
      const top = largestAcrossCurrencies(currencies, (c) => c.byMerchant);
      if (!top) return t("insights.noData");
      return t("qa.a.topMerchant", {
        merchant: top.merchant,
        amount: formatAmount(top.total, currencies[0]!.currency, locale),
      });
    }

    case "topAccount": {
      if (currencies.length > 1) return multiCurrency();
      const top = largestAcrossCurrencies(currencies, (c) => c.byAccount);
      if (!top) return t("insights.noData");
      const name =
        accounts.find((account) => account.id === top.accountId)?.name ??
        top.accountId;
      return t("qa.a.topAccount", {
        account: name,
        amount: formatAmount(top.total, currencies[0]!.currency, locale),
      });
    }

    default:
      return t("insights.noData");
  }
}
