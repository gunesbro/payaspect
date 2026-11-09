import { isBudgetAccount, type Account, type AccountType } from "@payaspect/core";
import * as Crypto from "expo-crypto";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ScreenGate } from "../components/ScreenGate";
import {
  Card,
  Chip,
  EmptyText,
  ListRow,
  PrimaryButton,
  Screen,
  SectionTitle,
  TextField,
  Title,
} from "../components/ui";
import { useI18n } from "../i18n/I18nProvider";
import { useAppStore } from "../store/AppStore";
import { colors } from "../theme";

const ACCOUNT_TYPES: readonly AccountType[] = ["cash", "bank", "credit_card", "loan"];
const CURRENCIES = ["TRY", "USD", "EUR", "GBP"] as const;

export function AccountsScreen() {
  const { t } = useI18n();
  const { accounts, addAccount } = useAppStore();

  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("cash");
  const [currency, setCurrency] = useState("TRY");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (saving) return;

    const trimmed = name.trim();
    if (!trimmed) {
      setFormError(t("accounts.invalid"));
      return;
    }

    const account: Account = {
      id: Crypto.randomUUID(),
      name: trimmed,
      type,
      currency,
      isBudget: isBudgetAccount(type),
      creditLimit: null,
      statementDay: null,
      minPaymentDay: null,
      note: null,
      archived: false,
      createdAt: Date.now(),
    };

    setSaving(true);
    setFormError(null);
    try {
      await addAccount(account);
      setName("");
    } catch {
      setFormError(t("common.error"));
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
                subtitle={`${t(`account.type.${account.type}`)} · ${account.currency}`}
              />
            ))
          ) : (
            <EmptyText>{t("accounts.empty")}</EmptyText>
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

          {formError ? <Text style={styles.error}>{formError}</Text> : null}

          <PrimaryButton
            label={t("accounts.save")}
            onPress={() => void handleSave()}
            disabled={saving}
          />
        </Card>
      </Screen>
    </ScreenGate>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  label: { fontSize: 12, fontWeight: "600", color: colors.muted },
  error: { color: colors.danger, fontSize: 13 },
});
