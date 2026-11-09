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
  insertAccount,
  insertTransaction,
  listAccounts,
  listTransactions,
  summarizeSpending,
  formatAmount,
  formatDate,
  monthRange,
  type Account,
  type SpendingSummary,
  type Transaction,
} from "@payaspect/core";
import { getDatabase } from "./db";

type Status = "loading" | "ready" | "error";

const DAY = 86_400_000;

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
      setRangeLabel(`${formatDate(range.from, "tr")} – ${formatDate(range.to, "tr")}`);
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
      name: "Banka",
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
        date: now - DAY, merchant: "Kafe", note: null, isRecurring: false,
        source: "manual", createdAt: now - DAY,
      },
      {
        id: `t3_${now}`, type: "income", amount: 3000, currency: "TRY",
        accountId: account.id, toAccountId: null, categoryId: "sys_other",
        date: now, merchant: "Maaş", note: null, isRecurring: false,
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
        <Text>Veritabanı açılıyor…</Text>
      </View>
    );
  }

  if (status === "error") {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Hata: {error}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>PayAspect</Text>
      <Text style={styles.subtitle}>Bu ay ({rangeLabel})</Text>

      {summary && summary.byCurrency.length > 0 ? (
        summary.total != null && summary.currency ? (
          <Text>Toplam harcama: {formatAmount(summary.total, summary.currency)}</Text>
        ) : (
          summary.byCurrency.map((currency) => (
            <Text key={currency.currency}>
              {currency.currency}: {formatAmount(currency.total, currency.currency)}
            </Text>
          ))
        )
      ) : (
        <Text>Bu ay harcama yok</Text>
      )}

      <Text>Hesap: {accounts.length}</Text>

      <Text style={styles.subtitle}>İşlemler ({transactions.length})</Text>
      {transactions.map((t) => (
        <Text key={t.id}>
          • {t.merchant ?? t.type} — {formatAmount(t.amount, t.currency)}
        </Text>
      ))}

      <Button title="Örnek veri ekle" onPress={seedSampleData} />
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

