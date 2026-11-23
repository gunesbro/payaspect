import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  deleteBudget,
  deleteTransaction,
  insertAccount,
  insertCategory,
  insertTransaction,
  listAccounts,
  listAllCategories,
  listBudgets,
  listTransactions,
  markRecurringTransactions,
  monthRange,
  spendingTrend,
  summarizeSpending,
  updateCategory,
  updateTransaction,
  upsertBudget,
  type Account,
  type Budget,
  type Category,
  type DateRange,
  type SpendingSummary,
  type SpendingTrend,
  type Transaction,
} from "@payaspect/core";
import { getDatabase } from "../db";

type Status = "loading" | "ready" | "error";

interface AppStoreValue {
  status: Status;
  error: string | null;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  summary: SpendingSummary | null;
  trend: SpendingTrend | null;
  budgets: Budget[];
  range: DateRange;
  refresh: () => Promise<void>;
  addAccount: (account: Account) => Promise<void>;
  addCategory: (category: Category) => Promise<void>;
  updateCategory: (category: Category) => Promise<void>;
  addTransaction: (transaction: Transaction) => Promise<void>;
  updateTransaction: (transaction: Transaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  setBudget: (budget: Budget) => Promise<void>;
  removeBudget: (id: string) => Promise<void>;
  seedSampleData: () => Promise<void>;
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

const DAY = 86_400_000;

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<SpendingSummary | null>(null);
  const [trend, setTrend] = useState<SpendingTrend | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [range, setRange] = useState<DateRange>(() => monthRange());

  const load = useCallback(async (showLoading: boolean) => {
    if (showLoading) setStatus("loading");
    try {
      const db = await getDatabase();
      const nextRange = monthRange();
      const [nextAccounts, nextCategories, nextTransactions, nextSummary, nextTrend, nextBudgets] =
        await Promise.all([
          listAccounts(db),
          listAllCategories(db),
          // Recent transactions across all months; the dashboard filters by range.
          listTransactions(db, { limit: 100 }),
          summarizeSpending(db, nextRange),
          spendingTrend(db, { months: 6, reference: nextRange.from }),
          listBudgets(db),
        ]);

      setRange(nextRange);
      setAccounts(nextAccounts);
      setCategories(nextCategories);
      setTransactions(nextTransactions);
      setSummary(nextSummary);
      setTrend(nextTrend);
      setBudgets(nextBudgets);
      setError(null);
      setStatus("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setStatus("error");
    }
  }, []);

  /** Manual refresh: shows the loading state. */
  const refresh = useCallback(() => load(true), [load]);

  useEffect(() => {
    void load(true);
  }, [load]);

  const seedSampleData = useCallback(async () => {
    try {
      const db = await getDatabase();

      // Keep the dev seed idempotent so repeated taps do not duplicate data.
      if ((await listAccounts(db)).length > 0) {
        await load(false);
        return;
      }

      const now = Date.now();
      const account: Account = {
        id: `acc_${now}`,
        name: "Bank",
        type: "bank",
        currency: "TRY",
        isBudget: true,
        creditLimit: null,
        statementDay: null,
        minPaymentDay: null,
        note: null,
        archived: false,
        createdAt: now,
      };
      await insertAccount(db, account);

      const samples: Transaction[] = [
        {
          id: `t1_${now}`,
          type: "expense",
          amount: 129.9,
          currency: "TRY",
          accountId: account.id,
          toAccountId: null,
          categoryId: "sys_groceries",
          date: now,
          merchant: "Migros",
          note: null,
          isRecurring: false,
          source: "manual",
          createdAt: now,
        },
        {
          id: `t2_${now}`,
          type: "expense",
          amount: 45,
          currency: "TRY",
          accountId: account.id,
          toAccountId: null,
          categoryId: "sys_dining",
          date: now - DAY,
          merchant: "Cafe",
          note: null,
          isRecurring: false,
          source: "manual",
          createdAt: now - DAY,
        },
        {
          id: `t3_${now}`,
          type: "income",
          amount: 3000,
          currency: "TRY",
          accountId: account.id,
          toAccountId: null,
          categoryId: "sys_other",
          date: now,
          merchant: "Salary",
          note: null,
          isRecurring: false,
          source: "manual",
          createdAt: now,
        },
      ];
      for (const sample of samples) {
        await insertTransaction(db, sample);
      }

      await load(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setStatus("error");
    }
  }, [load]);

  const addAccount = useCallback(
    async (account: Account) => {
      const db = await getDatabase();
      await insertAccount(db, account);
      await load(false);
    },
    [load],
  );

  const addCategory = useCallback(
    async (category: Category) => {
      const db = await getDatabase();
      await insertCategory(db, category);
      await load(false);
    },
    [load],
  );

  const updateCategoryAction = useCallback(
    async (category: Category) => {
      const db = await getDatabase();
      await updateCategory(db, category);
      await load(false);
    },
    [load],
  );

  const addTransaction = useCallback(
    async (transaction: Transaction) => {
      const db = await getDatabase();
      await insertTransaction(db, transaction);
      // Refresh the recurring flags so the list reflects the new pattern.
      await markRecurringTransactions(db);
      await load(false);
    },
    [load],
  );

  const updateTransactionAction = useCallback(
    async (transaction: Transaction) => {
      const db = await getDatabase();
      await updateTransaction(db, transaction);
      await markRecurringTransactions(db);
      await load(false);
    },
    [load],
  );

  const deleteTransactionAction = useCallback(
    async (id: string) => {
      const db = await getDatabase();
      await deleteTransaction(db, id);
      await load(false);
    },
    [load],
  );

  const setBudget = useCallback(
    async (budget: Budget) => {
      const db = await getDatabase();
      await upsertBudget(db, budget);
      await load(false);
    },
    [load],
  );

  const removeBudget = useCallback(
    async (id: string) => {
      const db = await getDatabase();
      await deleteBudget(db, id);
      await load(false);
    },
    [load],
  );

  const value = useMemo<AppStoreValue>(
    () => ({
      status,
      error,
      accounts,
      categories,
      transactions,
      summary,
      trend,
      budgets,
      range,
      refresh,
      addAccount,
      addCategory,
      updateCategory: updateCategoryAction,
      addTransaction,
      updateTransaction: updateTransactionAction,
      deleteTransaction: deleteTransactionAction,
      setBudget,
      removeBudget,
      seedSampleData,
    }),
    [
      status,
      error,
      accounts,
      categories,
      transactions,
      summary,
      trend,
      budgets,
      range,
      refresh,
      addAccount,
      addCategory,
      updateCategoryAction,
      addTransaction,
      updateTransactionAction,
      deleteTransactionAction,
      setBudget,
      removeBudget,
      seedSampleData,
    ],
  );

  return (
    <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>
  );
}

export function useAppStore(): AppStoreValue {
  const value = useContext(AppStoreContext);
  if (!value) {
    throw new Error("useAppStore must be used inside AppStoreProvider");
  }
  return value;
}
