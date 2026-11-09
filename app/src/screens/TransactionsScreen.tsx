import { formatAmount, formatDate, type Locale, type Transaction } from "@payaspect/core";
import { useState } from "react";
import { Alert, Modal, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenGate } from "../components/ScreenGate";
import { TransactionForm } from "../components/TransactionForm";
import {
  Card,
  DangerButton,
  EmptyText,
  ListRow,
  Muted,
  Screen,
  SecondaryButton,
  Title,
} from "../components/ui";
import { useI18n } from "../i18n/I18nProvider";
import { useAppStore } from "../store/AppStore";
import { colors } from "../theme";

function transactionAmount(tx: Transaction, locale: Locale): string {
  const value = tx.type === "expense" ? -tx.amount : tx.amount;
  return formatAmount(value, tx.currency, locale);
}

export function TransactionsScreen() {
  const { t, locale } = useI18n();
  const { transactions, updateTransaction, deleteTransaction } = useAppStore();
  const [editing, setEditing] = useState<Transaction | null>(null);

  function closeEditor() {
    setEditing(null);
  }

  function confirmDelete(transaction: Transaction) {
    Alert.alert(t("tx.deleteTitle"), t("tx.deleteBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () => {
          void deleteTransaction(transaction.id)
            .then(closeEditor)
            .catch(() => Alert.alert(t("common.error"), t("tx.deleteFailed")));
        },
      },
    ]);
  }

  return (
    <ScreenGate>
      <Screen>
        <Title>{t("nav.transactions")}</Title>
        {transactions.length > 0 ? <Muted>{t("tx.tapToEdit")}</Muted> : null}
        <Card>
          {transactions.length > 0 ? (
            transactions.map((tx) => (
              <ListRow
                key={tx.id}
                title={tx.merchant ?? t(`tx.type.${tx.type}`)}
                subtitle={`${formatDate(tx.date, locale)} · ${t(`tx.type.${tx.type}`)}`}
                value={transactionAmount(tx, locale)}
                onPress={() => setEditing(tx)}
              />
            ))
          ) : (
            <EmptyText>{t("tx.empty")}</EmptyText>
          )}
        </Card>
      </Screen>

      <Modal
        visible={editing != null}
        animationType="slide"
        onRequestClose={closeEditor}
      >
        <SafeAreaView style={styles.modal} edges={["top", "left", "right", "bottom"]}>
          <ScrollView
            contentContainerStyle={styles.modalBody}
            keyboardShouldPersistTaps="handled"
          >
            <Title>{t("tx.edit")}</Title>
            {editing ? (
              <TransactionForm
                key={editing.id}
                initial={editing}
                submitLabel={t("tx.saveChanges")}
                onSubmit={updateTransaction}
                onSaved={closeEditor}
                extraActions={
                  <View style={styles.actions}>
                    <View style={styles.action}>
                      <SecondaryButton label={t("common.cancel")} onPress={closeEditor} />
                    </View>
                    <View style={styles.action}>
                      <DangerButton
                        label={t("common.delete")}
                        onPress={() => confirmDelete(editing)}
                      />
                    </View>
                  </View>
                }
              />
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </ScreenGate>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: colors.background },
  modalBody: { padding: 20, gap: 12 },
  actions: { flexDirection: "row", gap: 8 },
  action: { flex: 1 },
});
