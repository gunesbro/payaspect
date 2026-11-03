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
  type Account,
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
  const [totalSpent, setTotalSpent] = useState(0);

  async function refresh() {
    try {
      const db = await getDatabase();
      setAccounts(await listAccounts(db));
      setTransactions(await listTransactions(db));
      setTotalSpent((await summarizeSpending(db)).total);
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
      <Text>Toplam harcama: {formatAmount(totalSpent, "TRY")}</Text>
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

