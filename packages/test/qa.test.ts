import assert from "node:assert/strict";
import { test } from "node:test";

import { answerQuestion, ASKABLE_QUESTIONS } from "../src/domain/qa.ts";
import { defaultSystemCategories } from "../src/domain/categories.ts";
import { createTranslator } from "../src/i18n/index.ts";
import type {
  CategoryTrend,
  SpendingSummary,
  SpendingTrend,
  TrendPoint,
} from "../src/db/repositories/insights.ts";
import type { Account, Budget, Category } from "../src/domain/types.ts";

const en = createTranslator("en");
const tr = createTranslator("tr");

function points(totals: number[]): TrendPoint[] {
  return totals.map((total, index) => ({ from: index, to: index, total }));
}

function categoryTrend(
  currency: string,
  categoryId: string,
  totals: number[],
): CategoryTrend {
  return { currency, categoryId, points: points(totals) };
}

function summary(): SpendingSummary {
  return {
    byCurrency: [
      {
        currency: "TRY",
        total: 1000,
        byCategory: [
          { categoryId: "sys_groceries", total: 600 },
          { categoryId: "sys_dining", total: 400 },
        ],
        byAccount: [{ accountId: "acc_1", total: 1000 }],
        byMerchant: [
          { merchant: "Market A", total: 300 },
          { merchant: "Cafe", total: 100 },
        ],
      },
    ],
    total: 1000,
    currency: "TRY",
  };
}

function trend(): SpendingTrend {
  return {
    byCurrency: [{ currency: "TRY", points: points([200, 200, 1000]) }],
    byCategory: [
      categoryTrend("TRY", "sys_groceries", [100, 100, 600]),
      categoryTrend("TRY", "sys_dining", [100, 100, 400]),
    ],
  };
}

function account(): Account {
  return {
    id: "acc_1",
    name: "Checking",
    type: "bank",
    currency: "TRY",
    isBudget: true,
    creditLimit: null,
    statementDay: null,
    minPaymentDay: null,
    note: null,
    archived: false,
    createdAt: 0,
  };
}

function budget(): Budget {
  return {
    id: "b_1",
    categoryId: "sys_groceries",
    currency: "TRY",
    amount: 500,
    createdAt: 0,
  };
}

function context(overrides: Partial<Parameters<typeof answerQuestion>[1]> = {}) {
  return {
    summary: summary(),
    trend: trend(),
    budgets: [budget()],
    accounts: [account()],
    categories: defaultSystemCategories() as Category[],
    locale: "en" as const,
    ...overrides,
  };
}

test("all fixed questions produce a non-empty template answer", () => {
  assert.equal(ASKABLE_QUESTIONS.length, 7);
  for (const question of ASKABLE_QUESTIONS) {
    const answer = answerQuestion(question.id, context(), en);
    assert.ok(answer.length > 0, `no answer for ${question.id}`);
    assert.ok(!answer.startsWith("qa."), `unresolved key for ${question.id}`);
    assert.ok(!answer.startsWith("insights."), `unresolved key for ${question.id}`);
  }
});

test("month total and top category use the single currency", () => {
  assert.equal(
    answerQuestion("monthTotal", context(), en),
    "You spent ₺1,000.00 this month.",
  );
  assert.equal(
    answerQuestion("topCategory", context(), en),
    "Your biggest category was Groceries at ₺600.00.",
  );
});

test("month comparison reuses the template narrative", () => {
  assert.equal(
    answerQuestion("monthComparison", context(), en),
    "Spending is up 400.0% vs last month.",
  );
});

test("budget status picks the most-used budget and its currency", () => {
  assert.equal(
    answerQuestion("budgetStatus", context(), en),
    "Groceries budget exceeded by ₺100.00.",
  );
  assert.equal(
    answerQuestion("budgetStatus", context({ budgets: [] }), en),
    "No budgets set yet.",
  );
});

test("anomaly answer uses the top spike", () => {
  assert.equal(
    answerQuestion("anomalies", context(), en),
    "Groceries spending is 500.0% above its usual level.",
  );
  assert.equal(
    answerQuestion(
      "anomalies",
      context({
        trend: {
          byCurrency: [],
          byCategory: [categoryTrend("TRY", "sys_groceries", [100, 200])],
        },
      }),
      en,
    ),
    en("insights.anomalyNeedData"),
  );
});

test("merchant and account answers resolve names", () => {
  assert.equal(
    answerQuestion("topMerchant", context(), en),
    "You spent the most at Market A: ₺300.00.",
  );
  assert.equal(
    answerQuestion("topAccount", context(), en),
    "Most spending came from Checking: ₺1,000.00.",
  );
});

test("mixed currencies are never combined into one answer", () => {
  const mixed = summary();
  mixed.total = null;
  mixed.currency = null;
  mixed.byCurrency.push({
    currency: "USD",
    total: 20,
    byCategory: [{ categoryId: "sys_dining", total: 20 }],
    byAccount: [{ accountId: "acc_2", total: 20 }],
    byMerchant: [{ merchant: "Cafe", total: 20 }],
  });

  for (const id of ["monthTotal", "topCategory", "monthComparison", "topMerchant", "topAccount"] as const) {
    assert.equal(
      answerQuestion(id, context({ summary: mixed }), en),
      "You have spending in several currencies. Check each currency separately.",
    );
  }
});

test("missing data falls back to a clear sentence, not a guess", () => {
  for (const question of ASKABLE_QUESTIONS) {
    const answer = answerQuestion(
      question.id,
      context({ summary: null, trend: null, budgets: [] }),
      en,
    );
    assert.equal(answer, en("insights.noData"), `unexpected answer for ${question.id}`);
  }
});

test("Turkish templates resolve without English fallback or doubled percent signs", () => {
  const local = context({ locale: "tr" });
  const total = answerQuestion("monthTotal", local, tr);
  assert.equal(total, "Bu ay 1.000,00 ₺ harcadın.");

  const comparison = answerQuestion("monthComparison", local, tr);
  assert.ok(comparison.includes("400,0%"));
  assert.ok(!comparison.includes("%400"));

  const anomaly = answerQuestion("anomalies", local, tr);
  assert.ok(anomaly.includes("500,0%"));
  assert.ok(!anomaly.includes("%500"));
});
