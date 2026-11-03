import { useEffect, useState } from "react";
import { ActivityIndicator, Button, StyleSheet, Text, View } from "react-native";
import { insertAccount, listAccounts, type Account } from "@payaspect/core";
import { getDatabase } from "./db";

type Status = "loading" | "ready" | "error";

export default function App() {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);

  async function refresh() {
    try {
      const db = await getDatabase();
      setAccounts(await listAccounts(db));
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function addSampleAccount() {
    const db = await getDatabase();
    await insertAccount(db, {
      id: `acc_${Date.now()}`,
      name: "Nakit",
      type: "cash",
      currency: "TRY",
      isBudget: true,
      creditLimit: null,
      statementDay: null,
      minPaymentDay: null,
      note: null,
      archived: false,
      createdAt: Date.now(),
    });
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
    <View style={styles.container}>
      <Text style={styles.title}>PayAspect</Text>
      <Text>Durum: hazır — {accounts.length} hesap</Text>
      {accounts.map((a) => (
        <Text key={a.id}>
          • {a.name} ({a.type}) — {a.currency}
        </Text>
      ))}
      <Button title="Örnek hesap ekle" onPress={addSampleAccount} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 8 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 8 },
  title: { fontSize: 24, fontWeight: "bold" },
  error: { color: "red" },
});
