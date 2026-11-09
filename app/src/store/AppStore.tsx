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
  deleteTransaction,
  insertAccount,
  insertTransaction,
  listAccounts,
  listTransactions,
  monthRange,
  summarizeSpending,
  updateTransaction,
  type Account,
  type DateRange,
  type SpendingSummary,
  type Transaction,
} from "@payaspect/core";
import { getDatabase } from "../db";

type Status = "loading" | "ready" | "error";

interface AppStoreValue {
  status: Status;
  error: string | null;
  accounts: Account[];
  transactions: Transaction[];
  summary: SpendingSummary | null;
  range: DateRange;
  refresh: () => Promise<void>;
  addAccount: (account: Account) => Promise<void>;
  addTransaction: (transaction: Transaction) => Promise<void>;
  updateTransaction: (transaction: Transaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  seedSampleData: () => Promise<void>;
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

const DAY = 86_400_000;

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<SpendingSummary | null>(null);
  const [range, setRange] = useState<DateRange>(() => monthRange());

  const load = useCallback(async (showLoading: boolean) => {
    if (showLoading) setStatus("loading");
    try {
      const db = await getDatabase();
      const nextRange = monthRange();
      const [nextAccounts, nextTransactions, nextSummary] = await Promise.all([
        listAccounts(db),
        // Recent transactions across all months; the dashboard filters by range.
        listTransactions(db, { limit: 100 }),
        summarizeSpending(db, nextRange),
      ]);

      setRange(nextRange);
      setAccounts(nextAccounts);
      setTransactions(nextTransactions);
      setSummary(nextSummary);
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

  const addTransaction = useCallback(
    async (transaction: Transaction) => {
      const db = await getDatabase();
      await insertTransaction(db, transaction);
      await load(false);
    },
    [load],
  );

  const updateTransactionAction = useCallback(
    async (transaction: Transaction) => {
      const db = await getDatabase();
      await updateTransaction(db, transaction);
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

  const value = useMemo<AppStoreValue>(
    () => ({
      status,
      error,
      accounts,
      transactions,
      summary,
      range,
      refresh,
      addAccount,
      addTransaction,
      updateTransaction: updateTransactionAction,
      deleteTransaction: deleteTransactionAction,
      seedSampleData,
    }),
    [
      status,
      error,
      accounts,
      transactions,
      summary,
      range,
      refresh,
      addAccount,
      addTransaction,
      updateTransactionAction,
      deleteTransactionAction,
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
