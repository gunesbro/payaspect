import {
  ACCOUNT_TYPES,
  formatAmount,
  investmentTotals,
  isBudgetAccount,
  isTrackingAccount,
  type Account,
  type AccountType,
} from "@payaspect/core";
import * as Crypto from "expo-crypto";
import { useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { ScreenGate } from "../components/ScreenGate";
import {
  Card,
  Chip,
  EmptyText,
  ListRow,
  Muted,
  PrimaryButton,
  Screen,
  SecondaryButton,
  SectionTitle,
  TextField,
  Title,
} from "../components/ui";
import { useI18n } from "../i18n/I18nProvider";
import { useAppStore } from "../store/AppStore";
import { colors } from "../theme";

const CURRENCIES = ["TRY", "USD", "EUR", "GBP"] as const;

/** Null means "not set"; undefined means the input could not be parsed. */
function parseValue(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const value = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(value) || value < 0) return undefined;
  return Math.round(value * 100) / 100;
}

export function AccountsScreen() {
  const { t, locale } = useI18n();
  const { accounts, addAccount, setAccountValue } = useAppStore();

  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("cash");
  const [currency, setCurrency] = useState("TRY");
  const [valueText, setValueText] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingValue, setEditingValue] = useState<Account | null>(null);
  const [editValueText, setEditValueText] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const portfolio = investmentTotals(accounts);

  async function handleSave() {
    if (saving) return;

    const trimmed = name.trim();
    if (!trimmed) {
      setFormError(t("accounts.invalid"));
      return;
    }
    const currentValue = type === "investment" ? parseValue(valueText) : null;
    if (currentValue === undefined) {
      setFormError(t("accounts.invalidValue"));
      return;
    }

    const account: Account = {
      id: Crypto.randomUUID(),
      name: trimmed,
      type,
      currency,
      // Tracking accounts never take part in spending or budget totals.
      isBudget: isBudgetAccount(type),
      creditLimit: null,
      statementDay: null,
      minPaymentDay: null,
      currentValue,
      note: null,
      archived: false,
      createdAt: Date.now(),
    };

    setSaving(true);
    setFormError(null);
    try {
      await addAccount(account);
      setName("");
      setValueText("");
    } catch {
      setFormError(t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  function openValueEditor(account: Account) {
    setEditingValue(account);
    setEditValueText(
      account.currentValue == null ? "" : String(account.currentValue),
    );
    setEditError(null);
  }

  async function handleValueUpdate() {
    if (!editingValue) return;
    const value = parseValue(editValueText);
    if (value === undefined) {
      setEditError(t("accounts.invalidValue"));
      return;
    }
    setSaving(true);
    setEditError(null);
    try {
      await setAccountValue(editingValue.id, value);
      setEditingValue(null);
    } catch {
      setEditError(t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenGate>
      <Screen>
        <Title>{t("nav.accounts")}</Title>

        <Card>
          {accounts.length > 0 ? (
            accounts.map((account) => (
              <ListRow
                key={account.id}
                title={account.name}
                subtitle={`${t(`account.type.${account.type}`)} · ${account.currency}${
                  isTrackingAccount(account.type) ? ` · ${t("accounts.trackingOnly")}` : ""
                }`}
                value={
                  account.type === "investment" && account.currentValue != null
                    ? formatAmount(account.currentValue, account.currency, locale)
                    : undefined
                }
                onPress={
                  account.type === "investment" ? () => openValueEditor(account) : undefined
                }
              />
            ))
          ) : (
            <EmptyText>{t("accounts.empty")}</EmptyText>
          )}
        </Card>

        <Card>
          <SectionTitle>{t("accounts.portfolio")}</SectionTitle>
          {portfolio.length > 0 ? (
            portfolio.map((entry) => (
              <ListRow
                key={entry.currency}
                title={entry.currency}
                value={formatAmount(entry.total, entry.currency, locale)}
              />
            ))
          ) : (
            <EmptyText>{t("accounts.noPortfolio")}</EmptyText>
          )}
        </Card>

        <Card>
          <SectionTitle>{t("accounts.add")}</SectionTitle>

          <TextField
            label={t("accounts.name")}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />

          <Text style={styles.label}>{t("accounts.type")}</Text>
          <View style={styles.wrap}>
            {ACCOUNT_TYPES.map((option) => (
              <Chip
                key={option}
                label={t(`account.type.${option}`)}
                active={type === option}
                onPress={() => setType(option)}
              />
            ))}
          </View>

          <Text style={styles.label}>{t("tx.currency")}</Text>
          <View style={styles.wrap}>
            {CURRENCIES.map((code) => (
              <Chip
                key={code}
                label={code}
                active={currency === code}
                onPress={() => setCurrency(code)}
              />
            ))}
          </View>

          {type === "investment" ? (
            <>
              <Text style={styles.label}>{t("accounts.trackingOnly")}</Text>
              <TextField
                label={t("accounts.currentValue")}
                value={valueText}
                onChangeText={setValueText}
                keyboardType="decimal-pad"
                placeholder="0.00"
              />
            </>
          ) : null}

          {formError ? <Text style={styles.error}>{formError}</Text> : null}

          <PrimaryButton
            label={t("accounts.save")}
            onPress={() => void handleSave()}
            disabled={saving}
          />
        </Card>

        <Modal
          visible={editingValue != null}
          animationType="slide"
          transparent
          onRequestClose={() => setEditingValue(null)}
        >
          <View style={styles.overlay}>
            <View style={styles.dialog}>
              <ScrollView>
                <SectionTitle>
                  {editingValue ? t("accounts.updateValue") : ""}
                </SectionTitle>
                {editingValue ? <Muted>{editingValue.name}</Muted> : null}
                <TextField
                  label={t("accounts.currentValue")}
                  value={editValueText}
                  onChangeText={setEditValueText}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                />
                {editError ? <Text style={styles.error}>{editError}</Text> : null}
                <PrimaryButton
                  label={t("common.save")}
                  onPress={() => void handleValueUpdate()}
                  disabled={saving}
                />
                <SecondaryButton
                  label={t("common.cancel")}
                  onPress={() => setEditingValue(null)}
                  disabled={saving}
                />
              </ScrollView>
            </View>
          </View>
        </Modal>
      </Screen>
    </ScreenGate>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  label: { fontSize: 12, fontWeight: "600", color: colors.muted },
  error: { color: colors.danger, fontSize: 13 },
  overlay: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    maxHeight: "80%",
  },
});
