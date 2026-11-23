import {
  computeBudgetProgress,
  formatAmount,
  type Budget,
} from "@payaspect/core";
import * as Crypto from "expo-crypto";
import { useState } from "react";
import { Modal, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Card,
  Chip,
  DangerButton,
  EmptyText,
  Muted,
  PrimaryButton,
  SecondaryButton,
  SectionTitle,
  TextField,
  Title,
} from "../components/ui";
import { categoryLabel } from "../i18n/labels";
import { useI18n } from "../i18n/I18nProvider";
import { useAppStore } from "../store/AppStore";
import { colors } from "../theme";

const CURRENCIES = ["TRY", "USD", "EUR", "GBP"] as const;

function parseLimit(text: string): number | null {
  const normalized = text.trim().replace(/\s/g, "").replace(",", ".");
  if (!normalized) return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Add, edit and track monthly per-category limits. Currencies stay separate. */
export function BudgetPanel() {
  const { t, locale } = useI18n();
  const { accounts, categories, budgets, summary, setBudget, removeBudget } = useAppStore();

  const [editing, setEditing] = useState<Budget | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [currency, setCurrency] = useState("TRY");
  const [limitText, setLimitText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const expenseCategories = categories.filter((category) => category.type === "expense");
  const currencies = [
    ...new Set([
      ...CURRENCIES,
      ...accounts.map((account) => account.currency),
      ...budgets.map((budget) => budget.currency),
    ]),
  ].sort();
  const progress = computeBudgetProgress(budgets, summary);

  function openEditor(budget: Budget | null) {
    setEditing(budget);
    setCategoryId(budget?.categoryId ?? expenseCategories[0]?.id ?? null);
    setCurrency(budget?.currency ?? accounts[0]?.currency ?? "TRY");
    setLimitText(budget ? String(budget.amount) : "");
    setError(null);
  }

  function closeEditor() {
    setEditing(null);
    setError(null);
  }

  async function save() {
    const amount = parseLimit(limitText);
    if (!categoryId || !currency || amount == null) {
      setError(t("budget.invalid"));
      return;
    }

    const next: Budget = {
      id: editing?.id ?? `budget_${Crypto.randomUUID()}`,
      categoryId,
      currency,
      amount,
      createdAt: editing?.createdAt ?? Date.now(),
    };
    try {
      await setBudget(next);
      closeEditor();
    } catch {
      setError(t("common.error"));
    }
  }

  async function remove() {
    if (!editing) return;
    try {
      await removeBudget(editing.id);
      closeEditor();
    } catch {
      setError(t("common.error"));
    }
  }

  return (
    <>
      <Card>
        <SectionTitle>{t("budget.title")}</SectionTitle>
        {progress.length === 0 ? (
          <EmptyText>{t("budget.empty")}</EmptyText>
        ) : (
          progress.map((row) => {
            const label = categoryLabel(row.budget.categoryId, t, categories);
            const fill = Math.max(0, Math.min(1, row.ratio));
            const status = row.over
              ? t("budget.over", { amount: formatAmount(row.spent - row.budget.amount, row.budget.currency, locale) })
              : t("budget.remaining", { amount: formatAmount(row.remaining, row.budget.currency, locale) });

            return (
              <View key={row.budget.id} style={styles.row}>
                <PrimaryButton
                  label={`${label} · ${row.budget.currency}`}
                  onPress={() => openEditor(row.budget)}
                />
                <Muted>
                  {t("budget.spent", {
                    spent: formatAmount(row.spent, row.budget.currency, locale),
                    limit: formatAmount(row.budget.amount, row.budget.currency, locale),
                  })}
                </Muted>
                <View
                  accessible
                  accessibilityLabel={`${label}: ${status}`}
                  style={styles.track}
                >
                  <View
                    style={[
                      styles.fill,
                      {
                        width: `${fill * 100}%`,
                        backgroundColor: row.over ? colors.danger : colors.accent,
                      },
                    ]}
                  />
                </View>
                <Muted>{status}</Muted>
              </View>
            );
          })
        )}
        <PrimaryButton label={t("budget.add")} onPress={() => openEditor(null)} />
      </Card>

      <Modal visible={editing != null} animationType="slide" onRequestClose={closeEditor}>
        <SafeAreaView style={styles.modal} edges={["top", "left", "right", "bottom"]}>
          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Title>{editing ? t("budget.edit") : t("budget.new")}</Title>

            <Muted>{t("budget.category")}</Muted>
            <View style={styles.chips}>
              {expenseCategories.map((category) => (
                <Chip
                  key={category.id}
                  label={categoryLabel(category.id, t, categories)}
                  active={categoryId === category.id}
                  onPress={() => setCategoryId(category.id)}
                />
              ))}
            </View>

            <Muted>{t("budget.currency")}</Muted>
            <View style={styles.chips}>
              {currencies.map((code) => (
                <Chip
                  key={code}
                  label={code}
                  active={currency === code}
                  onPress={() => setCurrency(code)}
                />
              ))}
            </View>

            <TextField
              label={t("budget.amount")}
              value={limitText}
              onChangeText={setLimitText}
              keyboardType="numeric"
            />

            {error ? <Muted>{error}</Muted> : null}

            <PrimaryButton label={t("common.save")} onPress={() => void save()} />
            {editing ? (
              <DangerButton label={t("budget.remove")} onPress={() => void remove()} />
            ) : null}
            <SecondaryButton label={t("common.cancel")} onPress={closeEditor} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: { gap: 6, paddingVertical: 8 },
  track: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 5 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  modal: { flex: 1, backgroundColor: colors.background },
  modalBody: { padding: 20, gap: 12 },
});
