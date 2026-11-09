import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  createTranslator,
  insertAccount,
  insertTransaction,
  listAccounts,
  listTransactions,
  summarizeSpending,
  formatAmount,
  formatDate,
  monthRange,
  type Account,
  type Locale,
  type SpendingSummary,
  type Transaction,
} from "@payaspect/core";
import { getDatabase } from "./db";

type Status = "loading" | "ready" | "error";

const DAY = 86_400_000;
const LOCALE: Locale = "en";
const t = createTranslator(LOCALE);

export default function App() {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<SpendingSummary | null>(null);
  const [rangeLabel, setRangeLabel] = useState("");

  async function refresh() {
    try {
      const db = await getDatabase();
      const range = monthRange();

      setAccounts(await listAccounts(db));
      setTransactions(await listTransactions(db, { ...range, limit: 100 }));
      setSummary(await summarizeSpending(db, range));
      setRangeLabel(`${formatDate(range.from, LOCALE)} – ${formatDate(range.to, LOCALE)}`);
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function seedSampleData() {
    const db = await getDatabase();

    // Keep the dev seed idempotent so repeated taps do not duplicate data.
    if ((await listAccounts(db)).length > 0) {
      await refresh();
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
        id: `t1_${now}`, type: "expense", amount: 129.9, currency: "TRY",
        accountId: account.id, toAccountId: null, categoryId: "sys_groceries",
        date: now, merchant: "Migros", note: null, isRecurring: false,
        source: "manual", createdAt: now,
      },
      {
        id: `t2_${now}`, type: "expense", amount: 45, currency: "TRY",
        accountId: account.id, toAccountId: null, categoryId: "sys_dining",
        date: now - DAY, merchant: "Cafe", note: null, isRecurring: false,
        source: "manual", createdAt: now - DAY,
      },
      {
        id: `t3_${now}`, type: "income", amount: 3000, currency: "TRY",
        accountId: account.id, toAccountId: null, categoryId: "sys_other",
        date: now, merchant: "Salary", note: null, isRecurring: false,
        source: "manual", createdAt: now,
      },
    ];
    for (const t of samples) await insertTransaction(db, t);

    await refresh();
  }

  if (status === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text>{t("common.loading")}</Text>
      </View>
    );
  }

  if (status === "error") {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>
          {t("common.error")}: {error}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>PayAspect</Text>
      <Text style={styles.subtitle}>
        {t("insights.thisMonth")} ({rangeLabel})
      </Text>

      {summary && summary.byCurrency.length > 0 ? (
        summary.total != null && summary.currency ? (
          <Text>
            {t("insights.total")}: {formatAmount(summary.total, summary.currency)}
          </Text>
        ) : (
          summary.byCurrency.map((currency) => (
            <Text key={currency.currency}>
              {currency.currency}: {formatAmount(currency.total, currency.currency)}
            </Text>
          ))
        )
      ) : (
        <Text>{t("insights.noSpending")}</Text>
      )}

      <Text>{t("accounts.count", { count: accounts.length })}</Text>

      <Text style={styles.subtitle}>{t("tx.list", { count: transactions.length })}</Text>
      {transactions.map((tx) => (
        <Text key={tx.id}>
          • {tx.merchant ?? tx.type} — {formatAmount(tx.amount, tx.currency)}
        </Text>
      ))}

      <Button title={t("dev.seedSampleData")} onPress={seedSampleData} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 8 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 8 },
  title: { fontSize: 24, fontWeight: "bold" },
  subtitle: { fontSize: 16, fontWeight: "600", marginTop: 8 },
  error: { color: "red" },
});

